import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import type { Train } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/Combobox";
import { useConfirm } from "@/components/ConfirmProvider";
import { exportSheet } from "@/lib/excel-export";
import { Pencil, Trash2, RotateCcw, Plus, Power, Download } from "lucide-react";
import { toast } from "sonner";


const CATS = ["Vande Bharat", "Rajdhani", "Shatabdi"];

export default function TrainsPage() {
  const { trains, addTrain, updateTrain, toggleTrainStatus, softDeleteTrain, restoreTrain } = useData();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Train | null>(null);
  const [form, setForm] = useState<Partial<Train>>({ trainNumber: "", trainName: "", category: "Vande Bharat" });

  const hasFilter = q.trim() !== "";

  const filtered = useMemo(() =>
    trains.filter((t) => (showArchived ? t.isDeleted : !t.isDeleted) &&
      (!q || t.trainNumber.includes(q) || t.trainName.toLowerCase().includes(q.toLowerCase()))
    ), [trains, q, showArchived]);

  const openAdd = () => { setEditing(null); setForm({ trainNumber: "", trainName: "", category: "Vande Bharat" }); setOpen(true); };
  const openEdit = (t: Train) => { setEditing(t); setForm(t); setOpen(true); };

  const save = () => {
    if (!form.trainNumber || !form.trainName) { toast.error("Train number and name are required"); return; }
    if (editing) { updateTrain(editing.id, form); toast.success("Train updated"); }
    else { addTrain(form as any); toast.success("Train added"); }
    setOpen(false);
  };

  const downloadExcel = () => {
    const rows = filtered.map((t) => ({
      Number: t.trainNumber, Name: t.trainName, Category: t.category, Status: t.status,
    }));
    exportSheet(rows, `trains_${hasFilter ? "filtered" : "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`, "Trains");
    toast.success("Excel downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Trains</h1>
          <p className="text-sm text-slate-500">Manage escorted train services</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadExcel}>
            <Download className="h-4 w-4 mr-1" /> Download Excel {hasFilter ? "(Filtered)" : "(All)"}
          </Button>
          <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>{showArchived ? "Show Active" : "Show Archived"}</Button>
          <Button onClick={openAdd} className="bg-[#0b2545] hover:bg-[#0b2545]/90"><Plus className="h-4 w-4 mr-1" /> Add Train</Button>
        </div>
      </div>

      <Card><CardContent className="p-4">
        <Input placeholder="Search train number or name" value={q} onChange={(e) => setQ(e.target.value)} />
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr><th className="p-3">Number</th><th>Name</th><th>Category</th><th>Status</th><th className="text-right pr-3">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-semibold">{t.trainNumber}</td>
                  <td>{t.trainName}</td>
                  <td><Badge variant="outline">{t.category}</Badge></td>
                  <td><Badge className={t.status === "active" ? "bg-emerald-600" : "bg-slate-400"}>{t.status}</Badge></td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {showArchived ? (
                        <Button size="sm" variant="ghost" onClick={() => { restoreTrain(t.id); toast.success("Restored"); }}><RotateCcw className="h-4 w-4" /></Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const ok = await confirm({ title: "Toggle status?", confirmText: "Toggle" });
                            if (ok) toggleTrainStatus(t.id);
                          }}><Power className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const ok = await confirm({ title: "Archive train?", description: "Soft delete — can be restored later.", confirmText: "Archive", destructive: true });
                            if (ok) { softDeleteTrain(t.id); toast.success("Archived"); }
                          }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No trains found.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Train" : "Add Train"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Train Number *</Label><Input value={form.trainNumber ?? ""} onChange={(e) => setForm({ ...form, trainNumber: e.target.value })} /></div>
            <div><Label className="text-xs">Train Name *</Label><Input value={form.trainName ?? ""} onChange={(e) => setForm({ ...form, trainName: e.target.value })} /></div>
            <div><Label className="text-xs">Category</Label>
              <Combobox
                value={form.category as string}
                onChange={(v) => setForm({ ...form, category: v })}
                options={CATS.map((c) => ({ value: c, label: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#0b2545] hover:bg-[#0b2545]/90">{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

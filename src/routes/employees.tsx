import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import type { Employee } from "@/lib/types";
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

export const Route = createFileRoute("/employees")({ component: EmployeesPage });

const DESIGNATIONS = ["Asst", "Tech-I", "Tech-II", "Tech-III", "Sr.Tech", "Helper"];
const GROUPS = ["A", "B", "C", "D", "E", "F"];
const BATCHES = ["A BATCH", "B BATCH", "RAJDHANI", "SICKLINE/IOH", "VANDE BHARAT"];

const emptyForm: Partial<Employee> = {
  name: "", pfNumber: "", tokenNo: "", designation: "Tech-I", presentBatch: "A BATCH",
  groupType: "A", address: "", phone: "", dateOfBirth: "", dateOfJoining: "",
};

function EmployeesPage() {
  const { employees, addEmployee, updateEmployee, toggleEmployeeStatus, softDeleteEmployee, restoreEmployee } = useData();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [fDesig, setFDesig] = useState<string>("all");
  const [fGroup, setFGroup] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>(emptyForm);

  const hasFilter = q.trim() !== "" || fDesig !== "all" || fGroup !== "all" || fStatus !== "all";

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (showArchived ? !e.isDeleted : e.isDeleted) return false;
      if (q && ![e.name, e.pfNumber, e.tokenNo].some((s) => s.toLowerCase().includes(q.toLowerCase()))) return false;
      if (fDesig !== "all" && e.designation !== fDesig) return false;
      if (fGroup !== "all" && e.groupType !== fGroup) return false;
      if (fStatus !== "all" && e.status !== fStatus) return false;
      return true;
    });
  }, [employees, q, fDesig, fGroup, fStatus, showArchived]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setForm(e); setDialogOpen(true); };

  const save = () => {
    if (!form.name || !form.pfNumber || !form.tokenNo) {
      toast.error("Name, PF Number and Token No are required");
      return;
    }
    if (editing) {
      updateEmployee(editing.id, form);
      toast.success("Employee updated");
    } else {
      addEmployee(form as any);
      toast.success("Employee added");
    }
    setDialogOpen(false);
  };

  const downloadExcel = () => {
    const rows = filtered.map((e) => ({
      Sl: e.slNo, Name: e.name, "PF No": e.pfNumber, Token: e.tokenNo,
      Designation: e.designation, Batch: e.presentBatch, Group: e.groupType,
      Phone: e.phone, Address: e.address, Status: e.status,
    }));
    exportSheet(rows, `employees_${hasFilter ? "filtered" : "all"}_${new Date().toISOString().slice(0, 10)}.xlsx`, "Employees");
    toast.success("Excel downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Employees</h1>
          <p className="text-sm text-slate-500">Manage technical staff records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadExcel}>
            <Download className="h-4 w-4 mr-1" />
            Download Excel {hasFilter ? "(Filtered)" : "(All)"}
          </Button>
          <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Show Active" : "Show Archived"}
          </Button>
          <Button onClick={openAdd} className="bg-[#0b2545] hover:bg-[#0b2545]/90"><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Search name / token / PF" value={q} onChange={(e) => setQ(e.target.value)} />
          <Combobox
            value={fDesig}
            onChange={setFDesig}
            options={[{ value: "all", label: "All Designations" }, ...DESIGNATIONS.map((d) => ({ value: d, label: d }))]}
            placeholder="Designation"
          />
          <Combobox
            value={fGroup}
            onChange={setFGroup}
            options={[{ value: "all", label: "All Groups" }, ...GROUPS.map((g) => ({ value: g, label: `Group ${g}` }))]}
            placeholder="Group"
          />
          <Combobox
            value={fStatus}
            onChange={setFStatus}
            options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
            placeholder="Status"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="p-3">Sl</th><th>Name</th><th>PF No</th><th>Token</th>
                  <th>Designation</th><th>Batch</th><th>Group</th><th>Status</th><th className="text-right pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{e.slNo}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{e.pfNumber}</td>
                    <td>{e.tokenNo}</td>
                    <td>{e.designation}</td>
                    <td className="text-slate-600">{e.presentBatch}</td>
                    <td><Badge variant="outline">Group {e.groupType}</Badge></td>
                    <td>
                      <Badge className={e.status === "active" ? "bg-emerald-600" : "bg-slate-400"}>{e.status}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        {showArchived ? (
                          <Button size="sm" variant="ghost" onClick={() => { restoreEmployee(e.id); toast.success("Restored"); }}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={async () => {
                              const ok = await confirm({ title: `Toggle status for ${e.name}?`, confirmText: "Toggle" });
                              if (ok) toggleEmployeeStatus(e.id);
                            }}><Power className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={async () => {
                              const ok = await confirm({ title: `Archive ${e.name}?`, description: "This is a soft delete — the record can be restored later.", confirmText: "Archive", destructive: true });
                              if (ok) { softDeleteEmployee(e.id); toast.success("Archived"); }
                            }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-slate-500">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="PF Number *"><Input value={form.pfNumber ?? ""} onChange={(e) => setForm({ ...form, pfNumber: e.target.value })} /></Field>
            <Field label="Token No *"><Input value={form.tokenNo ?? ""} onChange={(e) => setForm({ ...form, tokenNo: e.target.value })} /></Field>
            <Field label="Designation">
              <Combobox
                value={form.designation as string}
                onChange={(v) => setForm({ ...form, designation: v })}
                options={DESIGNATIONS.map((d) => ({ value: d, label: d }))}
              />
            </Field>
            <Field label="Present Batch">
              <Combobox
                value={form.presentBatch as string}
                onChange={(v) => setForm({ ...form, presentBatch: v })}
                options={BATCHES.map((b) => ({ value: b, label: b }))}
              />
            </Field>
            <Field label="Group Type">
              <Combobox
                value={form.groupType as string}
                onChange={(v) => setForm({ ...form, groupType: v as any })}
                options={GROUPS.map((g) => ({ value: g, label: `Group ${g}` }))}
              />
            </Field>
            <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Address"><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Date of Birth"><Input type="date" value={form.dateOfBirth ?? ""} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></Field>
            <Field label="Date of Joining"><Input type="date" value={form.dateOfJoining ?? ""} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-[#0b2545] hover:bg-[#0b2545]/90">{editing ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

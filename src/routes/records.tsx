import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/Combobox";
import { FileDown, Pencil, Trash2 } from "lucide-react";
import { fmtDate, fmtHours } from "@/lib/ot-utils";
import { exportOtSlipPdf } from "@/lib/pdf-export";
import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/records")({ component: RecordsPage });

function RecordsPage() {
  const { dutySheets, employees, trains, deleteDutySheet } = useData();
  const confirm = useConfirm();
  const [emp, setEmp] = useState<string>("all");
  const [trn, setTrn] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => dutySheets.filter((s) => {
    if (emp !== "all" && s.employeeId !== emp) return false;
    if (trn !== "all" && !s.trainIds.includes(trn)) return false;
    if (from && s.periodEndDate < from) return false;
    if (to && s.periodStartDate > to) return false;
    return true;
  }).sort((a, b) => (a.periodStartDate < b.periodStartDate ? 1 : -1)), [dutySheets, emp, trn, from, to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">Duty Records</h1>
          <p className="text-sm text-slate-500">All saved 14-day duty sheets</p>
        </div>
        <Link to="/duty"><Button className="bg-[#0b2545] hover:bg-[#0b2545]/90">+ Extra Hour Slip</Button></Link>
      </div>

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Combobox
          value={emp}
          onChange={setEmp}
          options={[{ value: "all", label: "All Employees" }, ...employees.filter((e) => !e.isDeleted).map((e) => ({ value: e.id, label: e.name, hint: `Token ${e.tokenNo}` }))]}
          placeholder="Employee"
        />
        <Combobox
          value={trn}
          onChange={setTrn}
          options={[{ value: "all", label: "All Trains" }, ...trains.filter((t) => !t.isDeleted).map((t) => ({ value: t.id, label: `${t.trainNumber} — ${t.trainName}` }))]}
          placeholder="Train"
        />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
              <tr>
                <th className="p-3">Employee</th><th>Period</th><th>Trains</th>
                <th className="text-right">Actual</th><th className="text-right">Rostered</th>
                <th className="text-right">Ded.</th><th className="text-right">OT Payable</th>
                <th>Status</th>
                <th className="text-right pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const e = employees.find((x) => x.id === s.employeeId);
                const sheetTrains = s.trainIds.map((id) => trains.find((t) => t.id === id)).filter(Boolean) as any[];
                return (
                  <tr key={s.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-semibold">{e?.name ?? "Unknown"}</div>
                      <div className="text-xs text-slate-500">Token {e?.tokenNo} · Group {e?.groupType}</div>
                    </td>
                    <td>{fmtDate(s.periodStartDate)} – {fmtDate(s.periodEndDate)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {sheetTrains.map((t) => <Badge key={t.id} variant="outline" className="text-[10px]">{t.trainNumber}</Badge>)}
                        {s.manualTrainNote && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-300">+ {s.manualTrainNote}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-right">{fmtHours(s.totalActualHours)}</td>
                    <td className="text-right">{fmtHours(s.totalRosteredHours)}</td>
                    <td className="text-right">{s.deductionHours ? `-${fmtHours(s.deductionHours)}` : "—"}</td>
                    <td className="text-right font-bold text-emerald-700">{fmtHours(s.otPayable)}</td>
                    <td>
                      {s.isDraft
                        ? <Badge className="bg-amber-500 hover:bg-amber-500">Draft</Badge>
                        : <Badge className="bg-emerald-600 hover:bg-emerald-600">Saved</Badge>}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={s.isDraft} onClick={() => {
                          if (!e) return;
                          exportOtSlipPdf(s, e, sheetTrains);
                          toast.success("PDF exported");
                        }}><FileDown className="h-4 w-4" /></Button>
                        <Link to="/duty" search={{ id: s.id }}>
                          <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          const ok = await confirm({
                            title: "Delete this duty sheet?",
                            description: "This cannot be undone.",
                            confirmText: "Delete",
                            destructive: true,
                          });
                          if (ok) { deleteDutySheet(s.id); toast.success("Deleted"); }
                        }}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No duty sheets match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuid } from "uuid";
import { useData } from "@/context/DataContext";
import type { DeductionType, DutyDay, DutySheet, TimeSlot } from "@/lib/types";
import { deductionAmount, fmtDate, fmtHours, generate14Days, periodsOverlap, sumSlots } from "@/lib/ot-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, X, Save, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/duty")({
  component: DutyPage,
  validateSearch: (s: Record<string, unknown>) => ({ id: (s.id as string) || undefined }),
});

function DutyPage() {
  const { employees, trains, dutySheets, saveDutySheet } = useData();
  const nav = useNavigate();
  const { id: editId } = useSearch({ from: "/duty" }) as { id?: string };
  const existing = editId ? dutySheets.find((d) => d.id === editId) : undefined;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(existing ? 4 : 1);
  const [employeeId, setEmployeeId] = useState<string>(existing?.employeeId ?? "");
  const [trainIds, setTrainIds] = useState<string[]>(existing?.trainIds ?? []);
  const [startDate, setStartDate] = useState<string>(existing?.periodStartDate ?? "");
  const [days, setDays] = useState<DutyDay[]>(existing?.days ?? []);
  const [totalRostered, setTotalRostered] = useState<number>(existing?.totalRosteredHours ?? 96);
  const [deduction, setDeduction] = useState<DeductionType>(existing?.deductionType ?? "none");
  const [sheetId] = useState<string>(existing?.id ?? uuid());

  const activeEmp = employees.filter((e) => !e.isDeleted && e.status === "active");
  const activeTr = trains.filter((t) => !t.isDeleted && t.status === "active");
  const emp = employees.find((e) => e.id === employeeId);

  useEffect(() => {
    if (!existing && startDate && days.length === 0) {
      setDays(generate14Days(startDate));
    }
  }, [startDate, existing, days.length]);

  const endDate = useMemo(() => startDate ? format(addDays(parseISO(startDate), 13), "yyyy-MM-dd") : "", [startDate]);

  const overlaps = useMemo(() => {
    if (!employeeId || !startDate) return false;
    return dutySheets.some((s) =>
      s.id !== sheetId &&
      s.employeeId === employeeId &&
      periodsOverlap(s.periodStartDate, s.periodEndDate, startDate, endDate));
  }, [employeeId, startDate, endDate, dutySheets, sheetId]);

  const toggleTrain = (id: string) => {
    setTrainIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id];
      const t = trains.find((x) => x.id === id);
      if (t?.pairedTrainId && !next.includes(t.pairedTrainId)) next.push(t.pairedTrainId);
      return next;
    });
  };

  const totals = useMemo(() => {
    const totalActual = Math.round(days.reduce((a, d) => a + d.actualHours, 0) * 100) / 100;
    const ded = deductionAmount(deduction);
    const ot = Math.round((totalActual - totalRostered - ded) * 100) / 100;
    return { totalActual, ded, ot };
  }, [days, totalRostered, deduction]);

  const updateDay = (idx: number, patch: Partial<DutyDay>) => {
    setDays((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch } as DutyDay;
      merged.rosteredHours = patch.rosteredHours !== undefined ? patch.rosteredHours : sumSlots(merged.rosteredSlots);
      merged.actualHours = patch.actualHours !== undefined ? patch.actualHours : sumSlots(merged.actualSlots);
      merged.extraHours = Math.round((merged.actualHours - merged.rosteredHours) * 100) / 100;
      next[idx] = merged;
      return next;
    });
  };

  const save = () => {
    if (!emp) return toast.error("Select an employee");
    if (trainIds.length === 0) return toast.error("Select at least one train");
    if (!startDate) return toast.error("Pick a start date");
    if (overlaps) return toast.error("Overlaps with an existing duty sheet");
    const sheet: DutySheet = {
      id: sheetId, employeeId, trainIds,
      periodStartDate: startDate, periodEndDate: endDate,
      days,
      totalActualHours: totals.totalActual,
      totalRosteredHours: totalRostered,
      statutoryHours: 104,
      deductionType: deduction,
      deductionHours: totals.ded,
      otPayable: totals.ot,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDutySheet(sheet);
    toast.success("Duty sheet saved");
    nav({ to: "/records" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">{existing ? "Edit" : "New"} Duty Sheet</h1>
          <p className="text-sm text-slate-500">14-day OT calculation</p>
        </div>
        <Stepper step={step} />
      </div>

      {step === 1 && (
        <Card><CardHeader><CardTitle className="text-base">Step 1 — Select Employee</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose employee..." /></SelectTrigger>
              <SelectContent>
                {activeEmp.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} — Token {e.tokenNo} ({e.designation})</SelectItem>)}
              </SelectContent>
            </Select>
            {emp && (
              <div className="rounded-lg border bg-slate-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">Name</div><div className="font-semibold">{emp.name}</div></div>
                <div><div className="text-xs text-slate-500">Token</div><div className="font-semibold">{emp.tokenNo}</div></div>
                <div><div className="text-xs text-slate-500">PF No</div><div className="font-semibold">{emp.pfNumber}</div></div>
                <div><div className="text-xs text-slate-500">Designation</div><div className="font-semibold">{emp.designation}</div></div>
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={!employeeId} onClick={() => setStep(2)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card><CardHeader><CardTitle className="text-base">Step 2 — Select Train(s)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-500 rounded bg-amber-50 border border-amber-200 p-2">
              Note: Minimum crew per train is 2 technicians (informational).
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeTr.map((t) => {
                const on = trainIds.includes(t.id);
                return (
                  <label key={t.id} className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${on ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"}`}>
                    <Checkbox checked={on} onCheckedChange={() => toggleTrain(t.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{t.trainNumber} — {t.trainName}</div>
                      <div className="text-xs text-slate-500">{t.category}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button disabled={trainIds.length === 0} onClick={() => setStep(3)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card><CardHeader><CardTitle className="text-base">Step 3 — Select Start Date</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Start Date (Sunday recommended)</Label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDays(generate14Days(e.target.value)); }} className="max-w-xs" />
              </div>
              {startDate && (
                <div className="text-sm text-slate-600">
                  Period: <b>{fmtDate(startDate)}</b> to <b>{fmtDate(endDate)}</b>
                </div>
              )}
            </div>
            {startDate && format(parseISO(startDate), "EEEE") !== "Sunday" && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Warning: Selected date is not a Sunday. 14-day periods conventionally begin on Sundays.
              </div>
            )}
            {overlaps && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                Warning: This period overlaps with another duty sheet for the same employee.
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button disabled={!startDate} onClick={() => setStep(4)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card><CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Step 4 — 14-Day Grid</CardTitle>
          <div className="text-xs text-slate-500">Employee: <b>{emp?.name}</b> · Period: <b>{fmtDate(startDate)} – {fmtDate(endDate)}</b></div>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-[900px] w-full text-xs border">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="p-2 border">Day/Date</th>
                    <th className="p-2 border">Rostered Timings</th>
                    <th className="p-2 border w-20">R.Hrs</th>
                    <th className="p-2 border">Actual Timings</th>
                    <th className="p-2 border w-20">A.Hrs</th>
                    <th className="p-2 border w-20">Extra</th>
                    <th className="p-2 border min-w-[180px]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => (
                    <tr key={d.date} className={d.isRestDay ? "bg-amber-50" : ""}>
                      <td className="p-2 border align-top">
                        <div className="font-semibold">{d.dayName.slice(0, 3)}</div>
                        <div className="text-slate-500">{fmtDate(d.date)}</div>
                        <label className="flex items-center gap-1 mt-1 text-[10px]">
                          <Checkbox checked={d.isRestDay} onCheckedChange={(v) => updateDay(i, { isRestDay: !!v, rosteredSlots: v ? [] : d.rosteredSlots, rosteredHours: v ? 0 : d.rosteredHours })} />
                          REST
                        </label>
                      </td>
                      <td className="p-2 border align-top">
                        <SlotEditor disabled={d.isRestDay} slots={d.rosteredSlots} onChange={(s) => updateDay(i, { rosteredSlots: s, rosteredHours: sumSlots(s) })} />
                      </td>
                      <td className="p-2 border align-top">
                        <Input className="h-7 text-xs" type="number" step="0.01" value={d.rosteredHours} onChange={(e) => updateDay(i, { rosteredHours: Number(e.target.value) })} />
                      </td>
                      <td className="p-2 border align-top">
                        <SlotEditor slots={d.actualSlots} onChange={(s) => updateDay(i, { actualSlots: s, actualHours: sumSlots(s) })} />
                      </td>
                      <td className="p-2 border align-top">
                        <Input className="h-7 text-xs" type="number" step="0.01" value={d.actualHours} onChange={(e) => updateDay(i, { actualHours: Number(e.target.value) })} />
                        {d.actualHours > 16 && <div className="text-[10px] text-amber-700">High</div>}
                      </td>
                      <td className={`p-2 border align-top font-semibold ${d.extraHours < 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtHours(d.extraHours)}</td>
                      <td className="p-2 border align-top">
                        <Input className="h-7 text-xs" value={d.description} onChange={(e) => updateDay(i, { description: e.target.value })} placeholder="e.g. OT/OL Vande Bharat..." />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox label="Total Rostered" value={fmtHours(totalRostered)}>
                <Input className="mt-1 h-7" type="number" step="0.01" value={totalRostered} onChange={(e) => setTotalRostered(Number(e.target.value))} />
              </StatBox>
              <StatBox label="Total Actual" value={fmtHours(totals.totalActual)} />
              <StatBox label="Statutory (fixed)" value="104.00" />
              <StatBox label="OT Payable" value={fmtHours(totals.ot)} highlight />
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-sm font-semibold">Deduction</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                {([
                  ["none", "No Deduction (0h)"],
                  ["CR", "CR — Compensatory Rest (−8h)"],
                  ["CL_LAP_NH_PL_SCL_SICK", "CL / LAP / NH / PL / SCL / Sick (−1h)"],
                ] as [DeductionType, string][]).map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${deduction === v ? "border-blue-500 bg-blue-50" : ""}`}>
                    <input type="radio" name="ded" checked={deduction === v} onChange={() => setDeduction(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4 mr-1" /> Save Duty Sheet</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Employee", "Trains", "Date", "Grid"];
  return (
    <div className="flex items-center gap-1 text-xs">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-1">
          <div className={`h-6 w-6 rounded-full grid place-items-center font-bold text-[10px] ${i + 1 <= step ? "bg-[#0b2545] text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</div>
          <span className={`hidden sm:inline ${i + 1 === step ? "font-semibold" : "text-slate-500"}`}>{l}</span>
          {i < labels.length - 1 && <div className="w-6 h-px bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function StatBox({ label, value, highlight, children }: { label: string; value: string; highlight?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-emerald-50 border-emerald-300" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>{value}</div>
      {children}
    </div>
  );
}

function SlotEditor({ slots, onChange, disabled }: { slots: TimeSlot[]; onChange: (s: TimeSlot[]) => void; disabled?: boolean }) {
  if (disabled) return <div className="text-xs text-slate-500 italic">REST</div>;
  return (
    <div className="space-y-1">
      {slots.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input type="time" className="h-7 text-xs w-24" value={s.from} onChange={(e) => { const n = [...slots]; n[i] = { ...s, from: e.target.value }; onChange(n); }} />
          <span className="text-slate-400">–</span>
          <Input type="time" className="h-7 text-xs w-24" value={s.to} onChange={(e) => { const n = [...slots]; n[i] = { ...s, to: e.target.value }; onChange(n); }} />
          <button type="button" onClick={() => onChange(slots.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600"><X className="h-3 w-3" /></button>
        </div>
      ))}
      {slots.length < 4 && (
        <button type="button" onClick={() => onChange([...slots, { from: "08:00", to: "16:00" }])} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add slot
        </button>
      )}
    </div>
  );
}

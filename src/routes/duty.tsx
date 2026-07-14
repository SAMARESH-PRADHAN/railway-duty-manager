import { createFileRoute } from '@tanstack/react-router'
import { useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuid } from "uuid";
import { useData } from "@/context/DataContext";
import type { DutyDay, DutySheet, LeaveType, TimeSlot } from "@/lib/types";
import { LEAVE_OPTIONS, STATUTORY_HOURS, fmtDate, fmtHours, generate14Days, leaveDeduction, periodsOverlap, sumSlots, totalDeduction } from "@/lib/ot-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/Combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmProvider";
import { Plus, X, Save, ArrowLeft, ArrowRight, ChevronLeft, FileText, BedDouble } from "lucide-react";
import { toast } from "sonner";

export default function DutyPage() {
  const { employees, trains, dutySheets, saveDutySheet } = useData();
  const nav = useNavigate();
  const confirmDialog = useConfirm();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id") || undefined;
  const existing = editId ? dutySheets.find((d) => d.id === editId) : undefined;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(existing ? 4 : 1);
  const [employeeId, setEmployeeId] = useState<string>(existing?.employeeId ?? "");
  const [trainIds, setTrainIds] = useState<string[]>(existing?.trainIds ?? []);
  const [manualTrainNote, setManualTrainNote] = useState<string>(existing?.manualTrainNote ?? "");
  const [startDate, setStartDate] = useState<string>(existing?.periodStartDate ?? "");
  const [days, setDays] = useState<DutyDay[]>(existing?.days ?? []);
  const [sheetId] = useState<string>(existing?.id ?? uuid());
  const [dirty, setDirty] = useState(false);
  const initialLoad = useRef(true);

  const [sundayModalOpen, setSundayModalOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string>("");

  const [unsavedModal, setUnsavedModal] = useState<{ open: boolean; proceed: (() => void) | null }>({ open: false, proceed: null });

  const activeEmp = employees.filter((e) => !e.isDeleted && e.status === "active");
  const activeTr = trains.filter((t) => !t.isDeleted && t.status === "active");
  const emp = employees.find((e) => e.id === employeeId);

  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return; }
    setDirty(true);
  }, [employeeId, trainIds, manualTrainNote, startDate, days]);

  // Block cross-route navigation while dirty; show custom modal.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) return false;
    if (nextLocation.pathname === currentLocation.pathname) return false;
    return true;
  });
  useEffect(() => {
    if (blocker.state === "blocked") {
      setUnsavedModal({
        open: true,
        proceed: () => blocker.proceed?.(),
      });
    }
  }, [blocker]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);



  const endDate = useMemo(() => startDate ? format(addDays(parseISO(startDate), 13), "yyyy-MM-dd") : "", [startDate]);

  const overlaps = useMemo(() => {
    if (!employeeId || !startDate) return false;
    return dutySheets.some((s) =>
      s.id !== sheetId &&
      !s.isDraft &&
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

  // Leave semantics:
  // - CR: rostered hours ignored for OT loss; actual defaults to 0 (user may enter worked hours if any).
  // - Other paid leaves (CL/LAP/NH/PL/SCL/Sick): actual defaults to 7 hours (representing paid leave credit).
  // No implicit deduction is subtracted — actual hours as shown IS the value used for OT.
  const netActualOf = (d: DutyDay) => Math.max(0, Math.round(d.actualHours * 100) / 100);

  const totals = useMemo(() => {
    const totalActual = Math.round(days.reduce((a, d) => a + netActualOf(d), 0) * 100) / 100;
    const totalRost = Math.round(days.reduce((a, d) => a + d.rosteredHours, 0) * 100) / 100;
    const ded = totalDeduction(days);
    const ot = Math.round((totalActual - STATUTORY_HOURS) * 100) / 100;
    return { totalActual, totalRost, ded, ot };
  }, [days]);

  const bankedRestDays = useMemo(
    () => days.filter((d) => d.isRestDay && d.actualHours > 0),
    [days],
  );

  const updateDay = (idx: number, patch: Partial<DutyDay>) => {
    setDays((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch } as DutyDay;
      merged.rosteredHours = patch.rosteredHours !== undefined ? patch.rosteredHours : sumSlots(merged.rosteredSlots);
      merged.actualHours = patch.actualHours !== undefined ? patch.actualHours : sumSlots(merged.actualSlots);
      const net = Math.max(0, Math.round(merged.actualHours * 100) / 100);
      merged.extraHours = Math.round((net - merged.rosteredHours) * 100) / 100;
      next[idx] = merged;
      return next;
    });
  };

  // When user changes rostered slots, auto-copy into actual (as sensible default).
  const setRosteredSlots = (idx: number, slots: TimeSlot[]) => {
    updateDay(idx, { rosteredSlots: slots, rosteredHours: sumSlots(slots), actualSlots: slots.map((s) => ({ ...s })), actualHours: sumSlots(slots) });
  };

  const setLeave = (idx: number, leave: LeaveType) => {
    // Apply leave-specific default for actual hours.
    let actualPatch: Partial<DutyDay> = {};
    if (leave === "CR") {
      actualPatch = { actualSlots: [], actualHours: 0 };
    } else if (leave && leave !== "None") {
      // Other paid leaves default to 7 actual hours (no slots).
      actualPatch = { actualSlots: [], actualHours: 7 };
    }

    if (leave === "CR") {
      const used = new Set(
        days
          .map((d, k) => (k !== idx && d.leave === "CR" ? (d.description.match(/CR of (\d{2}\.\d{2}\.\d{4})/)?.[1] ?? "") : ""))
          .filter(Boolean)
      );
      const target = bankedRestDays.find((b) => !used.has(fmtDate(b.date)));
      if (target) {
        updateDay(idx, { leave, description: `CR of ${fmtDate(target.date)}`, ...actualPatch });
        return;
      }
    }
    updateDay(idx, { leave, ...actualPatch });
  };


  const applyStartDate = (iso: string) => {
    setStartDate(iso);
    setDays(generate14Days(iso));
  };

  const handleStartDateChange = (iso: string) => {
    if (!iso) return;
    const isSunday = format(parseISO(iso), "EEEE") === "Sunday";
    if (isSunday) {
      applyStartDate(iso);
    } else {
      setPendingStart(iso);
      setSundayModalOpen(true);
    }
  };

  const save = async (asDraft: boolean) => {
    if (!emp) return toast.error("Select an employee");
    if (!asDraft && trainIds.length === 0 && !manualTrainNote.trim()) return toast.error("Select at least one train or enter an emergency-duty note");
    if (!startDate) return toast.error("Pick a start date");
    if (!asDraft && overlaps) return toast.error("Overlaps with an existing duty sheet");
    const sheet: DutySheet = {
      id: sheetId, employeeId, trainIds,
      manualTrainNote: manualTrainNote.trim() || undefined,
      periodStartDate: startDate, periodEndDate: endDate,
      days,
      totalActualHours: totals.totalActual,
      totalRosteredHours: totals.totalRost,
      statutoryHours: STATUTORY_HOURS,
      deductionHours: totals.ded,
      otPayable: totals.ot,
      isDraft: asDraft,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDutySheet(sheet);
    setDirty(false);
    toast.success(asDraft ? "Saved as draft" : "Duty sheet saved");
    // Small tick so blocker sees dirty=false
    setTimeout(() => nav("/records"), 0);
  };

  const handleBack = async () => {
    if (step > 1 && !existing) { setStep((s) => (s - 1) as 1 | 2 | 3 | 4); return; }
    if (dirty) {
      setUnsavedModal({ open: true, proceed: () => nav("/records") });
    } else {
      nav("/records");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBack} className="shrink-0">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0b2545]">{existing ? "Edit" : "New"} Extra Hour Slip</h1>
            <p className="text-sm text-slate-500">14-day OT calculation</p>
          </div>
        </div>
        <Stepper step={step} />
      </div>

      {step === 1 && (
        <Card><CardHeader><CardTitle className="text-base">Step 1 — Select Employee</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Combobox
              className="max-w-md"
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Choose employee…"
              options={activeEmp.map((e) => ({ value: e.id, label: `${e.name} — Token ${e.tokenNo}`, hint: `PF ${e.pfNumber} · ${e.designation} · Group ${e.groupType}` }))}
            />
            {emp && (
              <div className="rounded-lg border bg-slate-50 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><div className="text-xs text-slate-500">Name</div><div className="font-semibold">{emp.name}</div></div>
                <div><div className="text-xs text-slate-500">Token</div><div className="font-semibold">{emp.tokenNo}</div></div>
                <div><div className="text-xs text-slate-500">PF No</div><div className="font-semibold">{emp.pfNumber}</div></div>
                <div><div className="text-xs text-slate-500">Designation</div><div className="font-semibold">{emp.designation}</div></div>
                <div><div className="text-xs text-slate-500">Group Type</div><div className="font-semibold">Group {emp.groupType}</div></div>
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={!employeeId} onClick={() => setStep(2)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next: Select Trains <ArrowRight className="h-4 w-4 ml-1" /></Button>
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
            <div>
              <Label className="text-xs">Other / Emergency Duty (manual entry, optional)</Label>
              <Input
                placeholder='e.g. "Emergency relief duty — special train"'
                value={manualTrainNote}
                onChange={(e) => setManualTrainNote(e.target.value)}
              />
            </div>
            <div className="flex justify-between flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back: Select Employee</Button>
              <Button disabled={trainIds.length === 0 && !manualTrainNote.trim()} onClick={() => setStep(3)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next: Select Date <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <>
          <Card><CardHeader><CardTitle className="text-base">Step 3 — Select Start Date</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Start Date (Sunday recommended)</Label>
                  <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="max-w-xs" />
                </div>
                {startDate && (
                  <div className="text-sm text-slate-600">
                    Period: <b>{fmtDate(startDate)}</b> to <b>{fmtDate(endDate)}</b>
                  </div>
                )}
              </div>
              {overlaps && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  Warning: This period overlaps with another duty sheet for the same employee.
                </div>
              )}
            </CardContent>
          </Card>

          <CopyFromPastDuty employeeId={employeeId} empName={emp?.name} sheets={dutySheets} sheetId={sheetId} days={days} setDays={setDays} startDate={startDate} onDone={() => setStep(4)} />

          <div className="flex justify-between flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back: Select Trains</Button>
            <Button disabled={!startDate} onClick={() => setStep(4)} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Next: 14-Day Grid <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </>
      )}

      {step === 4 && (
        <Card><CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Step 4 — 14-Day Grid</CardTitle>
          <div className="text-xs text-slate-500">Employee: <b>{emp?.name}</b> · Period: <b>{fmtDate(startDate)} – {fmtDate(endDate)}</b></div>
        </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-[1000px] w-full text-xs border">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="p-2 border sticky left-0 bg-slate-100 z-10">Day/Date</th>
                    <th className="p-2 border min-w-[200px]">Rostered Timings</th>
                    <th className="p-2 border w-20">R.Hrs</th>
                    <th className="p-2 border min-w-[220px]">Actual Timings</th>
                    <th className="p-2 border w-20">A.Hrs</th>
                    <th className="p-2 border w-20">Extra</th>
                    <th className="p-2 border min-w-[200px]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d, i) => {
                    const parts = d.description.split("\n");
                    const line1 = parts[0] ?? "";
                    const line2 = parts.length > 1 ? parts.slice(1).join("\n") : null;
                    const has2 = line2 !== null;
                    const toggleRest = () => {
                      const next = !d.isRestDay;
                      // Rest toggles the ROSTERED rest-day status only. Actual timings
                      // are preserved so the employee can still log work on a rostered
                      // rest day (that becomes a "banked" rest day for CR attribution).
                      updateDay(i, {
                        isRestDay: next,
                        rosteredSlots: next ? [] : (d.rosteredSlots.length ? d.rosteredSlots : [{ from: "08:00", to: "16:00" }]),
                        rosteredHours: next ? 0 : (d.rosteredSlots.length ? d.rosteredHours : 8),
                      });
                    };
                    return (
                      <tr key={d.date} className={d.isRestDay ? "bg-amber-50" : ""}>
                        <td className="p-2 border align-top sticky left-0 bg-inherit z-10">
                          <div className="font-semibold">{d.dayName.slice(0, 3)}</div>
                          <div className="text-slate-500 whitespace-nowrap">{fmtDate(d.date)}</div>
                          {d.isRestDay && <div className="mt-1 text-[10px] font-semibold text-amber-700">REST</div>}
                        </td>
                        <td className="p-2 border align-top">
                          <SlotEditor slots={d.rosteredSlots} onChange={(s) => setRosteredSlots(i, s)} isRest={d.isRestDay} onToggleRest={toggleRest} />
                        </td>
                        <td className="p-2 border align-top">
                          <Input className="h-7 text-xs w-full" type="number" step="0.01" value={d.rosteredHours} onChange={(e) => updateDay(i, { rosteredHours: Number(e.target.value) })} />
                        </td>
                        <td className="p-2 border align-top">
                          <SlotEditor
                            slots={d.actualSlots}
                            onChange={(s) => updateDay(i, { actualSlots: s, actualHours: sumSlots(s) })}
                            isRest={d.isRestDay}
                            onToggleRest={toggleRest}
                            leave={d.leave ?? "None"}
                            onLeaveChange={(v) => setLeave(i, v)}
                          />
                          {d.leave && d.leave !== "None" && (
                            <div className="text-[10px] text-slate-500 mt-1">Leave: {d.leave}</div>
                          )}
                        </td>
                        <td className="p-2 border align-top">
                          <Input
                            className="h-7 text-xs w-full"
                            type="number"
                            step="0.01"
                            value={netActualOf(d)}
                            onChange={(e) => updateDay(i, { actualHours: Number(e.target.value) })}
                            title="Actual hours — editable"
                          />
                          {d.actualHours > 16 && <div className="text-[10px] text-amber-700">High</div>}
                        </td>
                        <td className={`p-2 border align-top font-semibold ${d.extraHours < 0 ? "text-rose-600" : "text-emerald-700"}`}>{fmtHours(d.extraHours)}</td>
                        <td className="p-2 border align-top">
                          <div className="flex items-start gap-1">
                            <div className="flex-1 min-w-0 space-y-1">
                              <Input
                                className="h-7 text-xs"
                                value={line1}
                                onChange={(e) => updateDay(i, { description: has2 ? `${e.target.value}\n${line2}` : e.target.value })}
                                placeholder="Description…"
                              />
                              {has2 && (
                                <Input
                                  className="h-7 text-xs"
                                  value={line2 ?? ""}
                                  onChange={(e) => updateDay(i, { description: `${line1}\n${e.target.value}` })}
                                  placeholder="Second line…"
                                />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => updateDay(i, { description: has2 ? line1 : `${line1}\n` })}
                              className="shrink-0 mt-0.5 h-7 w-7 grid place-items-center rounded border text-slate-500 hover:bg-slate-100"
                              title={has2 ? "Remove second line" : "Add second description line"}
                            >
                              {has2 ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatBox label="Total Rostered" value={fmtHours(totals.totalRost)} />
              <StatBox label="Total Actual" value={fmtHours(totals.totalActual)} />
              <StatBox label="Statutory (fixed)" value="104.00" />
              <StatBox label="OT Payable (Actual − 104)" value={fmtHours(totals.ot)} highlight />
            </div>

            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
              Auto-summed leave deduction across all 14 rows: <b>{fmtHours(totals.ded)}</b> (informational — OT payable is calculated as Total Actual − Statutory 104).
            </div>

            <div className="flex justify-between flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-1" /> Back: Select Date</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => save(true)}><FileText className="h-4 w-4 mr-1" /> Save as Draft</Button>
                <Button onClick={() => save(false)} className="bg-emerald-600 hover:bg-emerald-700"><Save className="h-4 w-4 mr-1" /> Save Duty Sheet</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sunday warning modal */}
      <Dialog open={sundayModalOpen} onOpenChange={setSundayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Non-Sunday start date</DialogTitle>
            <DialogDescription>
              The selected date ({pendingStart && fmtDate(pendingStart)}) is not a Sunday.
              Duty periods conventionally start on Sunday. Do you want to continue with this date anyway?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => { setSundayModalOpen(false); setPendingStart(""); }}>Choose Another Date</Button>
            <Button className="bg-[#0b2545] hover:bg-[#0b2545]/90" onClick={() => { applyStartDate(pendingStart); setSundayModalOpen(false); setPendingStart(""); }}>Confirm &amp; Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>




      {/* Unsaved changes modal */}
      <Dialog open={unsavedModal.open} onOpenChange={(o) => { if (!o) setUnsavedModal({ open: false, proceed: null }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes in this duty sheet. What would you like to do?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setUnsavedModal({ open: false, proceed: null })}>Cancel</Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={async () => {
                  const proceed = unsavedModal.proceed;
                  const ok = await confirmDialog({
                    title: "Discard changes?",
                    description: "This will permanently discard your changes. Continue?",
                    confirmText: "Discard",
                    destructive: true,
                  });
                  if (ok) {
                    setDirty(false);
                    setUnsavedModal({ open: false, proceed: null });
                    setTimeout(() => proceed?.(), 0);
                  }
                }}
              >
                Discard &amp; Leave
              </Button>
              <Button
                className="bg-[#0b2545] hover:bg-[#0b2545]/90"
                onClick={async () => {
                  const proceed = unsavedModal.proceed;
                  setUnsavedModal({ open: false, proceed: null });
                  await save(true);
                  setTimeout(() => proceed?.(), 0);
                }}
              >
                Save as Draft
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-emerald-50 border-emerald-300" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}

function SlotEditor({ slots, onChange, isRest, onToggleRest, leave, onLeaveChange }: {
  slots: TimeSlot[];
  onChange: (s: TimeSlot[]) => void;
  isRest?: boolean;
  onToggleRest?: () => void;
  leave?: LeaveType;
  onLeaveChange?: (l: LeaveType) => void;
}) {
  return (
    <div className="space-y-1">
      {slots.map((s, i) => (
        <div key={i} className="flex items-center gap-1 flex-wrap">
          <Input type="time" className="h-7 text-xs w-[92px]" value={s.from} onChange={(e) => { const n = [...slots]; n[i] = { ...s, from: e.target.value }; onChange(n); }} />
          <span className="text-slate-400">–</span>
          <Input type="time" className="h-7 text-xs w-[92px]" value={s.to} onChange={(e) => { const n = [...slots]; n[i] = { ...s, to: e.target.value }; onChange(n); }} />
          <button type="button" onClick={() => onChange(slots.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600"><X className="h-3 w-3" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {slots.length < 4 && (
          <button type="button" onClick={() => onChange([...slots, { from: "08:00", to: "16:00" }])} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add slot
          </button>
        )}
        {onToggleRest && (
          <button
            type="button"
            onClick={onToggleRest}
            className={`text-[10px] flex items-center gap-1 rounded px-1.5 py-0.5 border ${isRest ? "bg-amber-100 border-amber-300 text-amber-800 font-semibold" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
          >
            <BedDouble className="h-3 w-3" /> {isRest ? "NoRest" : "Rest"}
          </button>
        )}
        {onLeaveChange && (
          <select
            className="h-6 text-[10px] border rounded px-1 bg-white"
            value={leave ?? "None"}
            onChange={(e) => onLeaveChange(e.target.value as LeaveType)}
          >
            {LEAVE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function CopyFromPastDuty({
  employeeId, empName, sheets, sheetId, days, setDays, startDate, onDone,
}: {
  employeeId: string; empName?: string; sheets: DutySheet[]; sheetId: string;
  days: DutyDay[]; setDays: (d: DutyDay[]) => void; startDate: string; onDone?: () => void;
}) {
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  const past = useMemo(() => {
    return sheets
      .filter((s) => s.employeeId === employeeId && s.id !== sheetId && !s.isDraft)
      .sort((a, b) => (a.periodStartDate < b.periodStartDate ? 1 : -1));
  }, [sheets, employeeId, sheetId]);

  const activeSheet = past.find((s) => s.id === selectedSheet);
  const noHistory = past.length === 0;

  const applyCopy = () => {
    if (!activeSheet || days.length === 0) return;
    const next = days.map((d, i) => {
      const src = activeSheet.days[i];
      if (!src) return d;
      return {
        ...d,
        isRestDay: src.isRestDay,
        rosteredSlots: src.rosteredSlots.map((s) => ({ ...s })),
        rosteredHours: src.rosteredHours,
        actualSlots: src.rosteredSlots.map((s) => ({ ...s })),
        actualHours: src.rosteredHours,
        extraHours: 0,
      };
    });
    setDays(next);
    toast.success("Roster copied from past duty sheet");
    setSelectedSheet("");
    onDone?.();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Copy roster from a past duty sheet (optional)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-slate-500">
          Copies the entire 14-day roster (rostered timings) from a past duty sheet into this new period.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Past Duty Sheet</Label>
            {noHistory ? (
              <div className="h-9 rounded-md border border-rose-200 bg-rose-50 px-3 flex items-center text-xs font-semibold text-rose-700">
                No history data for this employee{empName ? ` — ${empName}` : ""}
              </div>
            ) : (
              <Combobox
                value={selectedSheet}
                onChange={setSelectedSheet}
                options={past.map((s) => ({ value: s.id, label: `${fmtDate(s.periodStartDate)} → ${fmtDate(s.periodEndDate)}`, hint: `${s.days.length} days` }))}
                placeholder="Choose past sheet…"
              />
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button disabled={noHistory || !activeSheet || !startDate} onClick={applyCopy} className="bg-[#0b2545] hover:bg-[#0b2545]/90">Copy and Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}


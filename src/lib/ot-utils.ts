import { addDays, format, parseISO } from "date-fns";
import type { DutyDay, DutySheet, TimeSlot, LeaveType } from "./types";

export const LEAVE_OPTIONS: LeaveType[] = ["None", "CR", "CL", "LAP", "NH", "PL", "SCL", "Sick"];

export function slotHours(slot: TimeSlot): number {
  if (!slot.from || !slot.to) return 0;
  const [fh, fm] = slot.from.split(":").map(Number);
  const [th, tm] = slot.to.split(":").map(Number);
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0;
  let start = fh * 60 + fm;
  let end = th * 60 + tm;
  if (end <= start) end += 24 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}

export function sumSlots(slots: TimeSlot[]): number {
  return Math.round(slots.reduce((a, s) => a + slotHours(s), 0) * 100) / 100;
}

export function generate14Days(startISO: string): DutyDay[] {
  const start = parseISO(startISO);
  const days: DutyDay[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i);
    const dayName = format(d, "EEEE");
    const isRest = dayName === "Sunday";
    days.push({
      date: format(d, "yyyy-MM-dd"),
      dayName,
      isRestDay: isRest,
      rosteredSlots: isRest ? [] : [{ from: "08:00", to: "16:00" }],
      rosteredHours: isRest ? 0 : 8,
      actualSlots: isRest ? [] : [{ from: "08:00", to: "16:00" }],
      actualHours: isRest ? 0 : 8,
      extraHours: 0,
      description: "",
      leave: "None",
    });
  }
  return days;
}

export function leaveDeduction(l?: LeaveType): number {
  if (l === "CR") return 8;
  if (l && ["CL", "LAP", "NH", "PL", "SCL", "Sick"].includes(l)) return 1;
  return 0;
}

export function totalDeduction(days: DutyDay[]): number {
  return Math.round(days.reduce((a, d) => a + leaveDeduction(d.leave), 0) * 100) / 100;
}

export const STATUTORY_HOURS = 104;

export function recalcSheet(sheet: DutySheet): DutySheet {
  const days = sheet.days.map((d) => ({
    ...d,
    extraHours: Math.round((d.actualHours - d.rosteredHours) * 100) / 100,
  }));
  const totalActual = Math.round(days.reduce((a, d) => a + d.actualHours, 0) * 100) / 100;
  const totalRostered = Math.round(days.reduce((a, d) => a + d.rosteredHours, 0) * 100) / 100;
  const ded = totalDeduction(days);
  const ot = Math.round((totalActual - STATUTORY_HOURS) * 100) / 100;
  return {
    ...sheet,
    days,
    totalActualHours: totalActual,
    totalRosteredHours: totalRostered || sheet.totalRosteredHours || 96,
    statutoryHours: STATUTORY_HOURS,
    deductionHours: ded,
    otPayable: ot,
  };
}

export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return !(aEnd < bStart || bEnd < aStart);
}

export function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), "dd.MM.yyyy");
  } catch {
    return iso;
  }
}

export function fmtHours(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

/** Deprecated helper retained for back-compat with older serialized sheets. */
export function deductionAmount(t: string): number {
  if (t === "CR") return 8;
  if (t === "CL_LAP_NH_PL_SCL_SICK") return 1;
  return 0;
}

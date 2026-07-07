import { addDays, format, parseISO } from "date-fns";
import type { DutyDay, DutySheet, TimeSlot, DeductionType } from "./types";

export function slotHours(slot: TimeSlot): number {
  if (!slot.from || !slot.to) return 0;
  const [fh, fm] = slot.from.split(":").map(Number);
  const [th, tm] = slot.to.split(":").map(Number);
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0;
  let start = fh * 60 + fm;
  let end = th * 60 + tm;
  if (end <= start) end += 24 * 60; // cross midnight
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
      actualSlots: [],
      actualHours: 0,
      extraHours: 0,
      description: "",
    });
  }
  return days;
}

export function deductionAmount(t: DeductionType): number {
  if (t === "CR") return 8;
  if (t === "CL_LAP_NH_PL_SCL_SICK") return 1;
  return 0;
}

export function recalcSheet(sheet: DutySheet): DutySheet {
  const days = sheet.days.map((d) => {
    const rH = sumSlots(d.rosteredSlots);
    const aH = sumSlots(d.actualSlots);
    return {
      ...d,
      rosteredHours: d.rosteredHours || rH,
      actualHours: d.actualHours || aH,
      extraHours: Math.round(((d.actualHours || aH) - (d.rosteredHours || rH)) * 100) / 100,
    };
  });
  const totalActual = Math.round(days.reduce((a, d) => a + d.actualHours, 0) * 100) / 100;
  const totalRostered = sheet.totalRosteredHours || 96;
  const ded = deductionAmount(sheet.deductionType);
  const ot = Math.round((totalActual - totalRostered - ded) * 100) / 100;
  return {
    ...sheet,
    days,
    totalActualHours: totalActual,
    statutoryHours: 104,
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

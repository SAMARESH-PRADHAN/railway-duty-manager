import { addDays, format, parseISO } from "date-fns";
import type { DutyDay, DutySheet, TimeSlot, LeaveType } from "./types";
import type { Batch } from "./types";

export const LEAVE_OPTIONS: LeaveType[] = ["None", "CR", "CL", "LAP", "NH", "PL", "SCL", "Sick"];

/**
 * Designation-wise default roster start time (24h HH:MM).
 * Every shift is a standard 8-hour duty; the end time is derived automatically.
 * Edit this map to change the predefined timings.
 */
export const DESIGNATION_ROSTER_START: Record<string, string> = {
  "Helper": "06:00",
  "Sr.Tech": "08:00",
  "Tech-I": "09:00",
  "Tech-II": "10:00",
  "Tech-III": "11:00",
  "Asst": "09:30",
};
export const DEFAULT_ROSTER_START = "08:00";
export const DEFAULT_SHIFT_HOURS = 8;

function addHoursToHHMM(hhmm: string, hours: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + hours * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function defaultRosterSlot(designation?: string): TimeSlot {
  const from = (designation && DESIGNATION_ROSTER_START[designation]) || DEFAULT_ROSTER_START;
  return { from, to: addHoursToHHMM(from, DEFAULT_SHIFT_HOURS) };
}

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

// export function generate14Days(startISO: string, designation?: string): DutyDay[] {
//   const start = parseISO(startISO);
//   const slot = defaultRosterSlot(designation);
//   const days: DutyDay[] = [];
//   for (let i = 0; i < 14; i++) {
//     const d = addDays(start, i);
//     const dayName = format(d, "EEEE");
//     const isRest = dayName === "Sunday";
//     days.push({
//       date: format(d, "yyyy-MM-dd"),
//       dayName,
//       isRestDay: isRest,
//       actualIsRest: isRest,
//       rosteredSlots: isRest ? [] : [{ ...slot }],
//       rosteredHours: isRest ? 0 : DEFAULT_SHIFT_HOURS,
//       actualSlots: isRest ? [] : [{ ...slot }],
//       actualHours: isRest ? 0 : DEFAULT_SHIFT_HOURS,
//       extraHours: 0,
//       description: "",
//       leave: "None",
//     });
//   }
//   return days;
// }

export function generate14Days(
    startISO: string,
    batch?: Batch,
    designation?: string
): DutyDay[] {

    const start = parseISO(startISO);
    const days: DutyDay[] = [];

    for (let i = 0; i < 14; i++) {

        const roster = batch?.days.find(
            d => d.dayNumber === i + 1
        );

        let rosterSlots: TimeSlot[];
        let isRest: boolean;

        if (batch) {
            // Batch assigned: use its slots for this day (may legitimately be empty on a rest day)
            rosterSlots = roster?.slots?.map(s => ({ ...s })) ?? [];
            isRest = roster?.isRestDay ?? false;
        } else {
            // No batch: fall back to designation-based default 8-hour shift
            const dayName = format(addDays(start, i), "EEEE");
            isRest = dayName === "Sunday";
            rosterSlots = isRest ? [] : [defaultRosterSlot(designation)];
        }

        const rosterHours = sumSlots(rosterSlots);

        days.push({

            date: format(addDays(start, i), "yyyy-MM-dd"),

            dayName: format(addDays(start, i), "EEEE"),

            isRestDay: isRest,

            actualIsRest: isRest,

            rosteredSlots: rosterSlots,

            rosteredHours: rosterHours,

            actualSlots: rosterSlots.map(s => ({ ...s })),

            actualHours: rosterHours,

            extraHours: 0,

            description: "",

            leave: "None"

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

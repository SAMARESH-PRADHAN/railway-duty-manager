const STATUTORY_HOURS = 104;

/**
 * Leave deduction rules — ported 1:1 from frontend src/lib/ot-utils.ts.
 * CR (Compensatory Rest) deducts 8 hours; other paid leaves deduct 1 hour.
 */
function leaveDeduction(l) {
  if (l === "CR") return 8;
  if (l && ["CL", "LAP", "NH", "PL", "SCL", "Sick"].includes(l)) return 1;
  return 0;
}

function totalDeduction(days) {
  return Math.round(days.reduce((a, d) => a + leaveDeduction(d.leave), 0) * 100) / 100;
}

/**
 * Server-side source of truth for duty-sheet totals.
 * Mirrors frontend `recalcSheet` — recomputes extraHours per day, then totals,
 * deduction, and OT payable. The backend always recalculates on save; it
 * never trusts client-sent totals.
 */
function recalcSheet({ days, totalRosteredHoursFallback }) {
  const recalcedDays = days.map((d) => ({
    ...d,
    extraHours: Math.round((d.actualHours - d.rosteredHours) * 100) / 100,
  }));

  const totalActual = Math.round(recalcedDays.reduce((a, d) => a + d.actualHours, 0) * 100) / 100;
  const totalRostered = Math.round(recalcedDays.reduce((a, d) => a + d.rosteredHours, 0) * 100) / 100;
  const ded = totalDeduction(recalcedDays);
  const ot = Math.round((totalActual - STATUTORY_HOURS) * 100) / 100;

  return {
    days: recalcedDays,
    totalActualHours: totalActual,
    totalRosteredHours: totalRostered || totalRosteredHoursFallback || 96,
    statutoryHours: STATUTORY_HOURS,
    deductionHours: ded,
    otPayable: ot,
  };
}

function periodsOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || bEnd < aStart);
}

module.exports = { STATUTORY_HOURS, leaveDeduction, totalDeduction, recalcSheet, periodsOverlap };

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
function recalcSheet({ days, totalRosteredHoursFallback, isStatutory = true }) {
  const recalcedDays = days.map((d) => ({
    ...d,
    extraHours: Math.round((d.actualHours - d.rosteredHours) * 100) / 100,
  }));

 
    const totalActual = Math.round(
    recalcedDays.reduce((a, d) => a + Number(d.actualHours || 0), 0) * 100
  ) / 100;

  const totalRostered = Math.round(
    recalcedDays.reduce((a, d) => a + Number(d.rosteredHours || 0), 0) * 100
  ) / 100;

  const ded = totalDeduction(recalcedDays);

  const rosteredForOt =
    totalRostered || Number(totalRosteredHoursFallback) || 96;

  let ot;

  if (isStatutory) {
    // Statutory OT:
    // Total Actual - (Total Rostered + 8)
    ot =
      Math.round(
        (totalActual - (rosteredForOt + 8)) * 100
      ) / 100;
  } else {
    // Non-Statutory OT:
    // Total Actual - Total Rostered
    ot =
      Math.round(
        (totalActual - rosteredForOt) * 100
      ) / 100;
  }

  return {
    days: recalcedDays,
    totalActualHours: totalActual,
    totalRosteredHours: totalRostered || totalRosteredHoursFallback || 96,
    statutoryHours: STATUTORY_HOURS,
    isStatutory: !!isStatutory,
    deductionHours: ded,
    otPayable: ot,
  };
}

function periodsOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || bEnd < aStart);
}

module.exports = { STATUTORY_HOURS, leaveDeduction, totalDeduction, recalcSheet, periodsOverlap };

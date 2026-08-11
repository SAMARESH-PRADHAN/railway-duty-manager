const { randomUUID } = require("crypto");
const { sql } = require("../lib/db");
const { mapDutySheet } = require("../lib/mappers");
const { recalcSheet, periodsOverlap } = require("../lib/ot-utils");

async function listDutySheets(req, res) {
  const rows = await sql`SELECT * FROM duty_sheets ORDER BY period_start_date DESC`;
  res.json(rows.map(mapDutySheet));
}

async function getDutySheet(req, res) {
  const { id } = req.params;
  const [row] = await sql`SELECT * FROM duty_sheets WHERE id = ${id}`;
  if (!row) return res.status(404).json({ error: "Duty sheet not found" });
  res.json(mapDutySheet(row));
}

/**
 * Create-or-update in one call — mirrors `saveDutySheet` in DataContext.tsx,
 * which upserts by id. OT totals are always recalculated server-side (never
 * trusted from the client) using the same formula as frontend ot-utils.ts.
 */
async function saveDutySheet(req, res) {
  const b = req.body;

  if (!b.employeeId) return res.status(400).json({ error: "employeeId is required" });
  if (!b.periodStartDate || !b.periodEndDate) {
    return res.status(400).json({ error: "periodStartDate and periodEndDate are required" });
  }
  if (!Array.isArray(b.days) || b.days.length === 0) {
    return res.status(400).json({ error: "days must be a non-empty array" });
  }
  if (!b.isDraft && (!b.trainIds || b.trainIds.length === 0) && !b.manualTrainNote?.trim()) {
    return res.status(400).json({ error: "Select at least one train or provide a manual duty note" });
  }

  // Overlap guard for non-draft sheets, same rule as the frontend's `overlaps` check in duty.tsx.
  if (!b.isDraft) {
    const others = b.id
      ? await sql`SELECT * FROM duty_sheets WHERE employee_id = ${b.employeeId} AND is_draft = FALSE AND id != ${b.id}`
      : await sql`SELECT * FROM duty_sheets WHERE employee_id = ${b.employeeId} AND is_draft = FALSE`;

    const overlap = others.some((s) =>
      periodsOverlap(s.period_start_date, s.period_end_date, b.periodStartDate, b.periodEndDate)
    );
    if (overlap) {
      return res.status(409).json({ error: "Overlaps with an existing duty sheet for this employee" });
    }
  }

  const recalced = recalcSheet({ days: b.days, totalRosteredHoursFallback: b.totalRosteredHours, isStatutory: b.isStatutory !== false });
  const id = b.id || randomUUID();
  const trainIds = b.trainIds ?? [];
  const manualTrainNote = b.manualTrainNote?.trim() || null;
  const daysJson = JSON.stringify(recalced.days);

  const [existing] = await sql`SELECT id FROM duty_sheets WHERE id = ${id}`;

  let row;
  if (existing) {
    [row] = await sql`
      UPDATE duty_sheets SET
        employee_id = ${b.employeeId},
        train_ids = ${trainIds}::uuid[],
        manual_train_note = ${manualTrainNote},
        period_start_date = ${b.periodStartDate},
        period_end_date = ${b.periodEndDate},
        days = ${daysJson}::jsonb,
        total_actual_hours = ${recalced.totalActualHours},
        total_rostered_hours = ${recalced.totalRosteredHours},
        statutory_hours = ${recalced.statutoryHours},
        is_statutory = ${recalced.isStatutory},
        deduction_hours = ${recalced.deductionHours},
        ot_payable = ${recalced.otPayable},
        is_draft = ${!!b.isDraft}
      WHERE id = ${id}
      RETURNING *`;
  } else {
    [row] = await sql`
      INSERT INTO duty_sheets (
        id, employee_id, train_ids, manual_train_note, period_start_date, period_end_date,
        days, total_actual_hours, total_rostered_hours, statutory_hours, is_statutory,
        ot_payable, is_draft, deduction_hours
      ) VALUES (
        ${id}, ${b.employeeId}, ${trainIds}::uuid[], ${manualTrainNote}, ${b.periodStartDate}, ${b.periodEndDate},
        ${daysJson}::jsonb, ${recalced.totalActualHours}, ${recalced.totalRosteredHours},
        ${recalced.statutoryHours}, ${recalced.isStatutory}, ${recalced.otPayable}, ${!!b.isDraft}, ${recalced.deductionHours}
      )
      RETURNING *`;
  }

  res.status(200).json(mapDutySheet(row));
}

async function deleteDutySheet(req, res) {
  const { id } = req.params;
  const [row] = await sql`DELETE FROM duty_sheets WHERE id = ${id} RETURNING id`;
  if (!row) return res.status(404).json({ error: "Duty sheet not found" });
  res.status(204).send();
}

module.exports = { listDutySheets, getDutySheet, saveDutySheet, deleteDutySheet };

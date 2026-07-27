const { sql } = require("../lib/db");
const { mapEmployee, mapTrain, mapDutySheet, mapBatch } = require("../lib/mappers");

async function exportBackup(req, res) {
  const { from, to } = req.query;

  const employees = await sql`SELECT * FROM employees ORDER BY sl_no ASC`;
  const trains = await sql`SELECT * FROM trains ORDER BY created_at ASC`;
  const batches = await sql`SELECT * FROM batches ORDER BY name ASC`;
  const batchDays = await sql`SELECT * FROM batch_roster_days ORDER BY day_number ASC`;

  // Only duty sheets are date-filterable; employees/trains/batches are master
  // data and always come along in full so restore is self-consistent.
  const dutySheets = (from && to)
    ? await sql`
        SELECT * FROM duty_sheets
        WHERE period_start_date <= ${to} AND period_end_date >= ${from}
        ORDER BY period_start_date ASC`
    : await sql`SELECT * FROM duty_sheets ORDER BY period_start_date ASC`;

  const daysByBatch = {};
  for (const d of batchDays) (daysByBatch[d.batch_id] ||= []).push(d);

  res.json({
    exportedAt: new Date().toISOString(),
    range: { from: from || null, to: to || null },
    employees: employees.map(mapEmployee),
    trains: trains.map(mapTrain),
    batches: batches.map((b) => mapBatch(b, daysByBatch[b.id] || [])),
    dutySheets: dutySheets.map(mapDutySheet),
  });
}

/**
 * Wipes ALL data and reloads exactly what's in the backup, preserving the
 * original ids (duty sheets / employees reference batch/train ids by id).
 */
async function restoreBackup(req, res) {
  const { employees = [], trains = [], batches = [], dutySheets = [] } = req.body;

  await sql`DELETE FROM duty_sheets`;
  await sql`DELETE FROM batch_roster_days`;
  await sql`DELETE FROM batches`;
  await sql`DELETE FROM trains`;
  await sql`DELETE FROM employees`;

  for (const e of employees) {
    await sql`
      INSERT INTO employees (
        id, sl_no, name, pf_number, token_no, designation, present_batch, batch_id,
        group_type, address, phone, date_of_birth, date_of_joining, status, is_deleted
      ) VALUES (
        ${e.id}, ${e.slNo}, ${e.name}, ${e.pfNumber}, ${e.tokenNo}, ${e.designation},
        ${e.presentBatch}, ${e.batchId ?? null}, ${e.groupType}, ${e.address}, ${e.phone},
        ${e.dateOfBirth || null}, ${e.dateOfJoining || null}, ${e.status}, ${!!e.isDeleted}
      )`;
  }

  for (const t of trains) {
    await sql`
      INSERT INTO trains (id, train_number, train_name, category, status, is_deleted)
      VALUES (${t.id}, ${t.trainNumber}, ${t.trainName}, ${t.category}, ${t.status}, ${!!t.isDeleted})`;
  }
  for (const t of trains) {
    if (t.pairedTrainId) {
      await sql`UPDATE trains SET paired_train_id = ${t.pairedTrainId} WHERE id = ${t.id}`;
    }
  }

  for (const b of batches) {
    await sql`
      INSERT INTO batches (id, name, is_deleted, roster_configured)
      VALUES (${b.id}, ${b.name}, ${!!b.isDeleted}, ${!!b.rosterConfigured})`;
    for (const d of b.days || []) {
      await sql`
        INSERT INTO batch_roster_days (batch_id, day_number, is_rest_day, slots)
        VALUES (${b.id}, ${d.dayNumber}, ${!!d.isRestDay}, ${JSON.stringify(d.slots || [])})`;
    }
  }

  for (const s of dutySheets) {
    await sql`
      INSERT INTO duty_sheets (
        id, employee_id, train_ids, manual_train_note, period_start_date, period_end_date,
        days, total_actual_hours, total_rostered_hours, statutory_hours, deduction_hours,
        ot_payable, is_draft
      ) VALUES (
        ${s.id}, ${s.employeeId}, ${s.trainIds}::uuid[], ${s.manualTrainNote || null},
        ${s.periodStartDate}, ${s.periodEndDate}, ${JSON.stringify(s.days)}::jsonb,
        ${s.totalActualHours}, ${s.totalRosteredHours}, ${s.statutoryHours},
        ${s.deductionHours}, ${s.otPayable}, ${!!s.isDraft}
      )`;
  }

  res.json({
    employees: employees.length,
    trains: trains.length,
    batches: batches.length,
    dutySheets: dutySheets.length,
  });
}

module.exports = { exportBackup, restoreBackup };
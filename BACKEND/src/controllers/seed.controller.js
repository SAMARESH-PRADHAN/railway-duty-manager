const { sql } = require("../lib/db");
const { buildSeedEmployees, buildSeedTrains, buildSeedDutySheets } = require("../lib/seed");

/**
 * Wipes all data and reseeds with demo employees/trains/duty-sheets.
 * Mirrors `resetDemo` in the frontend's DataContext.tsx.
 */
async function resetDemoData(req, res) {
  await sql`DELETE FROM duty_sheets`;
  await sql`DELETE FROM trains`;
  await sql`DELETE FROM employees`;

  const empSeeds = buildSeedEmployees();
  const empRows = [];
  for (const e of empSeeds) {
    const [row] = await sql`
      INSERT INTO employees (sl_no, name, pf_number, token_no, designation, present_batch, group_type, address, phone, status)
      VALUES (${e.slNo}, ${e.name}, ${e.pfNumber}, ${e.tokenNo}, ${e.designation}, ${e.presentBatch}, ${e.groupType}, ${e.address}, ${e.phone}, ${e.status})
      RETURNING *`;
    empRows.push(row);
  }

  // Trains are inserted with pre-generated ids so paired_train_id references resolve correctly.
  const trainSeeds = buildSeedTrains();
  const trainRows = [];
  for (const t of trainSeeds) {
    const [row] = await sql`
      INSERT INTO trains (id, train_number, train_name, category, status)
      VALUES (${t.id}, ${t.trainNumber}, ${t.trainName}, ${t.category}, ${t.status})
      RETURNING *`;
    trainRows.push(row);
  }
  for (const t of trainSeeds) {
    if (t.pairedTrainId) {
      await sql`UPDATE trains SET paired_train_id = ${t.pairedTrainId} WHERE id = ${t.id}`;
    }
  }

  const sheetSeeds = buildSeedDutySheets(
    empRows.map((r) => ({ id: r.id })),
    trainRows.map((r) => ({ id: r.id }))
  );
  for (const s of sheetSeeds) {
    await sql`
      INSERT INTO duty_sheets (
        employee_id, train_ids, manual_train_note, period_start_date, period_end_date,
        days, total_actual_hours, total_rostered_hours, statutory_hours, deduction_hours,
        ot_payable, is_draft
      ) VALUES (
        ${s.employeeId}, ${s.trainIds}::uuid[], ${s.manualTrainNote}, ${s.periodStartDate}, ${s.periodEndDate},
        ${JSON.stringify(s.days)}::jsonb, ${s.totalActualHours}, ${s.totalRosteredHours},
        ${s.statutoryHours}, ${s.deductionHours}, ${s.otPayable}, ${s.isDraft}
      )`;
  }

  res.json({ employees: empRows.length, trains: trainRows.length, dutySheets: sheetSeeds.length });
}

module.exports = { resetDemoData };

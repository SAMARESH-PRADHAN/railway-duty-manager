const { sql } = require("../lib/db");
const { mapEmployee } = require("../lib/mappers");

async function listEmployees(req, res) {
  const includeDeleted = req.query.includeDeleted === "true";
  const rows = includeDeleted
    ? await sql`SELECT * FROM employees ORDER BY sl_no ASC`
    : await sql`SELECT * FROM employees WHERE is_deleted = FALSE ORDER BY sl_no ASC`;
  res.json(rows.map(mapEmployee));
}

async function createEmployee(req, res) {
  const b = req.body;
  if (!b.name || !b.pfNumber || !b.tokenNo) {
    return res.status(400).json({ error: "name, pfNumber, and tokenNo are required" });
  }

  // slNo auto-increments off the max existing value — mirrors addEmployee in DataContext.tsx.
  const [{ next_sl_no }] = await sql`SELECT COALESCE(MAX(sl_no), 0) + 1 AS next_sl_no FROM employees`;

  const [row] = await sql`
    INSERT INTO employees (
      sl_no, name, pf_number, token_no, designation, present_batch,
      group_type, address, phone, date_of_birth, date_of_joining, status
    ) VALUES (
      ${next_sl_no}, ${b.name}, ${b.pfNumber}, ${b.tokenNo},
      ${b.designation ?? "Tech-I"}, ${b.presentBatch ?? "A BATCH"}, ${b.groupType ?? "A"},
      ${b.address ?? ""}, ${b.phone ?? ""}, ${b.dateOfBirth || null}, ${b.dateOfJoining || null},
      ${b.status ?? "active"}
    )
    RETURNING *`;

  res.status(201).json(mapEmployee(row));
}

async function updateEmployee(req, res) {
  const { id } = req.params;
  const b = req.body;
  const [existing] = await sql`SELECT * FROM employees WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const [row] = await sql`
    UPDATE employees SET
      name = ${b.name ?? existing.name},
      pf_number = ${b.pfNumber ?? existing.pf_number},
      token_no = ${b.tokenNo ?? existing.token_no},
      designation = ${b.designation ?? existing.designation},
      present_batch = ${b.presentBatch ?? existing.present_batch},
      group_type = ${b.groupType ?? existing.group_type},
      address = ${b.address ?? existing.address},
      phone = ${b.phone ?? existing.phone},
      date_of_birth = ${b.dateOfBirth ?? existing.date_of_birth},
      date_of_joining = ${b.dateOfJoining ?? existing.date_of_joining},
      status = ${b.status ?? existing.status}
    WHERE id = ${id}
    RETURNING *`;

  res.json(mapEmployee(row));
}

async function toggleEmployeeStatus(req, res) {
  const { id } = req.params;
  const [existing] = await sql`SELECT * FROM employees WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Employee not found" });
  const nextStatus = existing.status === "active" ? "inactive" : "active";
  const [row] = await sql`UPDATE employees SET status = ${nextStatus} WHERE id = ${id} RETURNING *`;
  res.json(mapEmployee(row));
}

// async function softDeleteEmployee(req, res) {
//   const { id } = req.params;
//   const [row] = await sql`UPDATE employees SET is_deleted = TRUE WHERE id = ${id} RETURNING *`;
//   if (!row) return res.status(404).json({ error: "Employee not found" });
//   res.json(mapEmployee(row));
// }

// async function restoreEmployee(req, res) {
//   const { id } = req.params;
//   const [row] = await sql`UPDATE employees SET is_deleted = FALSE WHERE id = ${id} RETURNING *`;
//   if (!row) return res.status(404).json({ error: "Employee not found" });
//   res.json(mapEmployee(row));
// }
async function deleteEmployee(req, res) {
  const { id } = req.params;

  const [existing] = await sql`SELECT id FROM employees WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM duty_sheets WHERE employee_id = ${id}`;
  if (count > 0) {
    return res.status(409).json({
      error: `Cannot delete — this employee has ${count} duty sheet(s). Delete those first, or contact an admin.`,
    });
  }

  await sql`DELETE FROM employees WHERE id = ${id}`;
  res.status(204).send();
}

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  // softDeleteEmployee, // keep — used elsewhere, harmless to leave
  // restoreEmployee,     // keep — same reason
  deleteEmployee,       // add
};

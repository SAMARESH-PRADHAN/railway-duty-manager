const { sql } = require("../lib/db");
const { mapDesignation } = require("../lib/mappers");

async function listDesignations(req, res) {
  const includeDeleted = req.query.includeDeleted === "true";
  const rows = includeDeleted
    ? await sql`SELECT * FROM designations ORDER BY name ASC`
    : await sql`SELECT * FROM designations WHERE is_deleted = FALSE ORDER BY name ASC`;
  res.json(rows.map(mapDesignation));
}
function toTitleCase(str) {
  return str.trim().split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
// Case-insensitive find, or create. Used both by the management page's
// "Add" button and by Excel import for unknown designations.
async function findOrCreateDesignation(req, res) {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Designation name is required" });

  const [existing] = await sql`
    SELECT * FROM designations WHERE LOWER(name) = LOWER(${name}) AND is_deleted = FALSE`;
  if (existing) return res.json(mapDesignation(existing));

   try {
    const [row] = await sql`INSERT INTO designations (name) VALUES (${name}) RETURNING *`;
    res.status(201).json(mapDesignation(row));
  } catch (err) {
    // Unique violation (race condition — someone else inserted the same name
    // a moment ago) — just look it up and return the existing row instead of failing.
    if (err.code === "23505") {
      const [row] = await sql`SELECT * FROM designations WHERE LOWER(name) = LOWER(${name}) AND is_deleted = FALSE`;
      return res.json(mapDesignation(row));
    }
    throw err;
  }
}
// Rename — cascades to every employee currently using the old name.
async function updateDesignation(req, res) {
  const { id } = req.params;
  const newName = (req.body.name || "").trim();
  if (!newName) return res.status(400).json({ error: "Name is required" });

  const [existing] = await sql`SELECT * FROM designations WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Designation not found" });

  const [dup] = await sql`
    SELECT id FROM designations WHERE LOWER(name) = LOWER(${newName}) AND id != ${id}`;
  if (dup) return res.status(409).json({ error: `Designation "${newName}" already exists` });

  const [row] = await sql`UPDATE designations SET name = ${newName} WHERE id = ${id} RETURNING *`;

  if (existing.name.trim().toLowerCase() !== newName.trim().toLowerCase()) {
    await sql`
      UPDATE employees SET designation = ${newName}
      WHERE LOWER(designation) = LOWER(${existing.name})`;
  }

  res.json(mapDesignation(row));
}

// Hard delete — blocked if any active employee still references this name.
async function deleteDesignation(req, res) {
  const { id } = req.params;
  const [existing] = await sql`SELECT * FROM designations WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Designation not found" });

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM employees
    WHERE LOWER(designation) = LOWER(${existing.name}) AND is_deleted = FALSE`;
  if (count > 0) {
    return res.status(409).json({
      error: `Cannot delete — ${count} employee(s) currently have designation "${existing.name}". Reassign them first.`,
    });
  }

  await sql`DELETE FROM designations WHERE id = ${id}`;
  res.status(204).send();
}

module.exports = { listDesignations, findOrCreateDesignation, updateDesignation, deleteDesignation };
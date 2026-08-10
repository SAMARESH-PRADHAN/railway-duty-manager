const { sql } = require("../lib/db");
const { mapGroupType } = require("../lib/mappers");

async function listGroupTypes(req, res) {
  const includeDeleted = req.query.includeDeleted === "true";
  const rows = includeDeleted
    ? await sql`SELECT * FROM group_types ORDER BY name ASC`
    : await sql`SELECT * FROM group_types WHERE is_deleted = FALSE ORDER BY name ASC`;
  res.json(rows.map(mapGroupType));
}

// Case-insensitive find, or create. Used both by the management page's
// "Add" button and by Excel import for unknown GroupType.
async function findOrCreateGroupType(req, res) {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "GroupType name is required" });

  const [existing] = await sql`
    SELECT * FROM group_types WHERE LOWER(name) = LOWER(${name}) AND is_deleted = FALSE`;
  if (existing) return res.json(mapGroupType(existing));

  const [row] = await sql`INSERT INTO group_types (name) VALUES (${name}) RETURNING *`;
  res.status(201).json(mapGroupType(row));
}

// Rename — cascades to every employee currently using the old name.
async function updateGroupType(req, res) {
  const { id } = req.params;
  const newName = (req.body.name || "").trim();
  if (!newName) return res.status(400).json({ error: "Name is required" });

  const [existing] = await sql`SELECT * FROM group_types WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "GroupType not found" });

  const [dup] = await sql`
    SELECT id FROM group_types WHERE LOWER(name) = LOWER(${newName}) AND id != ${id}`;
  if (dup) return res.status(409).json({ error: `GroupType "${newName}" already exists` });

  const [row] = await sql`UPDATE group_types SET name = ${newName} WHERE id = ${id} RETURNING *`;

  if (existing.name.trim().toLowerCase() !== newName.trim().toLowerCase()) {
    await sql`
      UPDATE employees SET group_type = ${newName}
      WHERE LOWER(group_type) = LOWER(${existing.name})`;
  }

  res.json(mapGroupType(row));
}

// Hard delete — blocked if any active employee still references this name.
async function deleteGroupType(req, res) {
  const { id } = req.params;
  const [existing] = await sql`SELECT * FROM group_types WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "GroupType not found" });

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM employees
    WHERE LOWER(group_type) = LOWER(${existing.name}) AND is_deleted = FALSE`;
  if (count > 0) {
    return res.status(409).json({
      error: `Cannot delete — ${count} employee(s) currently have group_type "${existing.name}". Reassign them first.`,
    });
  }

  await sql`DELETE FROM group_types WHERE id = ${id}`;
  res.status(204).send();
}

module.exports = { listGroupTypes, findOrCreateGroupType, updateGroupType, deleteGroupType };
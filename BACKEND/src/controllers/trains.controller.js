const { sql } = require("../lib/db");
const { mapTrain } = require("../lib/mappers");

async function listTrains(req, res) {
  const includeDeleted = req.query.includeDeleted === "true";
  const rows = includeDeleted
    ? await sql`SELECT * FROM trains ORDER BY created_at ASC`
    : await sql`SELECT * FROM trains WHERE is_deleted = FALSE ORDER BY created_at ASC`;
  res.json(rows.map(mapTrain));
}

async function createTrain(req, res) {
  const b = req.body;
  if (!b.trainNumber || !b.trainName) {
    return res.status(400).json({ error: "trainNumber and trainName are required" });
  }
  const [row] = await sql`
    INSERT INTO trains (train_number, train_name, category, paired_train_id, status)
    VALUES (${b.trainNumber}, ${b.trainName}, ${b.category ?? "Vande Bharat"}, ${b.pairedTrainId ?? null}, ${b.status ?? "active"})
    RETURNING *`;
  res.status(201).json(mapTrain(row));
}

async function updateTrain(req, res) {
  const { id } = req.params;
  const b = req.body;
  const [existing] = await sql`SELECT * FROM trains WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Train not found" });

  const [row] = await sql`
    UPDATE trains SET
      train_number = ${b.trainNumber ?? existing.train_number},
      train_name = ${b.trainName ?? existing.train_name},
      category = ${b.category ?? existing.category},
      paired_train_id = ${b.pairedTrainId ?? existing.paired_train_id},
      status = ${b.status ?? existing.status}
    WHERE id = ${id}
    RETURNING *`;

  res.json(mapTrain(row));
}

async function toggleTrainStatus(req, res) {
  const { id } = req.params;
  const [existing] = await sql`SELECT * FROM trains WHERE id = ${id}`;
  if (!existing) return res.status(404).json({ error: "Train not found" });
  const nextStatus = existing.status === "active" ? "inactive" : "active";
  const [row] = await sql`UPDATE trains SET status = ${nextStatus} WHERE id = ${id} RETURNING *`;
  res.json(mapTrain(row));
}

async function softDeleteTrain(req, res) {
  const { id } = req.params;
  const [row] = await sql`UPDATE trains SET is_deleted = TRUE WHERE id = ${id} RETURNING *`;
  if (!row) return res.status(404).json({ error: "Train not found" });
  res.json(mapTrain(row));
}

async function restoreTrain(req, res) {
  const { id } = req.params;
  const [row] = await sql`UPDATE trains SET is_deleted = FALSE WHERE id = ${id} RETURNING *`;
  if (!row) return res.status(404).json({ error: "Train not found" });
  res.json(mapTrain(row));
}

module.exports = {
  listTrains,
  createTrain,
  updateTrain,
  toggleTrainStatus,
  softDeleteTrain,
  restoreTrain,
};

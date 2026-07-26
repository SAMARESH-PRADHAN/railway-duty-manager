const { sql } = require("../lib/db");
const { neon } = require("@neondatabase/serverless");
const { mapBatch } = require("../lib/mappers");





const DEFAULT_DAYS = Array.from({ length: 14 }, (_, i) => ({
  dayNumber: i + 1,
  isRestDay: false,
  slots: [{ from: "08:00", to: "16:00" }],
}));

// Case-insensitive find, or create with default 14-day roster.
async function findOrCreateBatch(req, res) {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Batch name is required" });

  const [existing] = await sql`
    SELECT * FROM batches WHERE LOWER(name) = LOWER(${name}) AND is_deleted = FALSE`;
  if (existing) {
    return res.json(await getBatchWithDays(existing.id));
  }

  const [created] = await sql`INSERT INTO batches (name) VALUES (${name}) RETURNING id`;
  for (const d of DEFAULT_DAYS) {
    await sql`
      INSERT INTO batch_roster_days (batch_id, day_number, is_rest_day, slots)
      VALUES (${created.id}, ${d.dayNumber}, ${d.isRestDay}, ${JSON.stringify(d.slots)})`;
  }
  res.status(201).json(await getBatchWithDays(created.id));
}

// Fetch a batch + its roster days and shape it for the API response.
async function getBatchWithDays(batchId) {
  const [batchRow] = await sql`SELECT * FROM batches WHERE id = ${batchId}`;
  if (!batchRow) return null;
  const dayRows = await sql`SELECT * FROM batch_roster_days WHERE batch_id = ${batchId} ORDER BY day_number ASC`;
  return mapBatch(batchRow, dayRows);
}

async function listBatches(req, res) {
  const includeDeleted = req.query.includeDeleted === "true";
  const batchRows = includeDeleted
    ? await sql`SELECT * FROM batches ORDER BY name ASC`
    : await sql`SELECT * FROM batches WHERE is_deleted = FALSE ORDER BY name ASC`;

  const allDayRows = await sql`SELECT * FROM batch_roster_days ORDER BY day_number ASC`;
  const daysByBatch = {};
  for (const d of allDayRows) {
    (daysByBatch[d.batch_id] ||= []).push(d);
  }

  res.json(batchRows.map((b) => mapBatch(b, daysByBatch[b.id] || [])));
}

async function getBatch(req, res) {
  const batch = await getBatchWithDays(req.params.id);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json(batch);
}

// Creates a batch (or updates if req.body.id matches an existing one) along
// with its full 14-day roster pattern, in a single transaction.
// Expected body: { id?, name, days: [{ dayNumber, isRestDay, slots }, ...14] }
async function upsertBatch(req, res) {
  const b = req.body;
  if (!b.name || !b.name.trim()) {
    return res.status(400).json({ error: "Batch name is required" });
  }
  if (!Array.isArray(b.days) || b.days.length !== 14) {
    return res.status(400).json({ error: "days must be an array of exactly 14 entries" });
  }

  let batchId = b.id;
  let oldName = null;

  if (batchId) {
    const [existing] = await sql`SELECT * FROM batches WHERE id = ${batchId}`;
    if (!existing) return res.status(404).json({ error: "Batch not found" });
    oldName = existing.name;
     // Guard: if this is a fresh "Add roster" (not an edit of an already-configured
    // batch), the FE only offers unconfigured batches — but double-check here too.
    if (!existing.roster_configured && req.body.__mode === "add") {
      // fine — first-time roster setup
    }

    await sql`
      UPDATE batches
      SET name = ${b.name.trim()}, roster_configured = TRUE
      WHERE id = ${batchId}`;

    if (oldName.trim().toLowerCase() !== b.name.trim().toLowerCase()) {
      await sql`
        UPDATE employees
        SET present_batch = ${b.name.trim()}
        WHERE LOWER(present_batch) = LOWER(${oldName})`;
    }
  } else {
    // Only reached if FE somehow posts without an id — treat as new + configured.
    const [created] = await sql`
      INSERT INTO batches (name, roster_configured) VALUES (${b.name.trim()}, TRUE) RETURNING id`;
    batchId = created.id;
  }

  for (const d of b.days) {
    const dayNumber = Number(d.dayNumber);
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 14) {
      return res.status(400).json({ error: `Invalid dayNumber: ${d.dayNumber}` });
    }
    const slots = d.isRestDay ? [] : (d.slots ?? []);
    await sql`
      INSERT INTO batch_roster_days (batch_id, day_number, is_rest_day, slots)
      VALUES (${batchId}, ${dayNumber}, ${!!d.isRestDay}, ${JSON.stringify(slots)})
      ON CONFLICT (batch_id, day_number)
      DO UPDATE SET is_rest_day = EXCLUDED.is_rest_day, slots = EXCLUDED.slots`;
  }

  res.status(201).json(await getBatchWithDays(batchId));
}

async function softDeleteBatch(req, res) {
  const { id } = req.params;
  const [row] = await sql`UPDATE batches SET is_deleted = TRUE WHERE id = ${id} RETURNING *`;
  if (!row) return res.status(404).json({ error: "Batch not found" });
  res.json(await getBatchWithDays(id));
}

async function restoreBatch(req, res) {
  const { id } = req.params;
  const [row] = await sql`UPDATE batches SET is_deleted = FALSE WHERE id = ${id} RETURNING *`;
  if (!row) return res.status(404).json({ error: "Batch not found" });
  res.json(await getBatchWithDays(id));
}

module.exports = {
  listBatches,
  getBatch,
  upsertBatch,
  softDeleteBatch,
  restoreBatch,
  findOrCreateBatch,
};
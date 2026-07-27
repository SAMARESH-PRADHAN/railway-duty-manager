require("dotenv").config();


const fs = require("fs");
const path = require("path");
const batchesRoutes = require("./routes/batches.routes");
const express = require("express");
const cors = require("cors");

const { testConnection, sql, pool } = require("./lib/db");

const employeesRoutes = require("./routes/employees.routes");
const trainsRoutes = require("./routes/trains.routes");
const dutySheetsRoutes = require("./routes/duty-sheets.routes");
const seedRoutes = require("./routes/seed.routes");
const backupRoutes = require("./routes/backup.routes"); //for backup file

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", async (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/employees", employeesRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/duty-sheets", dutySheetsRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/batches", batchesRoutes);
app.use("/api/backup", backupRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Applies sql/schema.sql automatically on every boot. Uses the raw Pool
// (not the tagged-template `sql` helper) because schema.sql has multiple
// semicolon-separated statements. Safe to run repeatedly — every statement
// uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
async function applySchema() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  if (pool) {
    // Local pg driver — pool is exported from lib/db.js
    const client = await pool.connect();
    try {
      await client.query(schemaSql);
      console.log("✅ Schema applied/verified.");
    } finally {
      client.release();
    }
  } else {
    // Neon driver — no pool object exported; use its own Pool just for this.
    const { Pool } = require("@neondatabase/serverless");
    const neonPool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
    const client = await neonPool.connect();
    try {
      await client.query(schemaSql);
      console.log("✅ Schema applied/verified (Neon).");
    } finally {
      client.release();
      await neonPool.end();
    }
  }
}

async function startServer() {
  await testConnection();
  await applySchema();

  app.listen(PORT, () => {
    console.log(`🚀 OTA Manager backend running on http://localhost:${PORT}`);
  });
}

startServer();
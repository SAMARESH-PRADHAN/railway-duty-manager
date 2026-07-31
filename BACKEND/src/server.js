require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const batchesRoutes = require("./routes/batches.routes");
const { testConnection, sql, pool } = require("./lib/db");

const employeesRoutes = require("./routes/employees.routes");
const trainsRoutes = require("./routes/trains.routes");
const dutySheetsRoutes = require("./routes/duty-sheets.routes");
const seedRoutes = require("./routes/seed.routes");
const backupRoutes = require("./routes/backup.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", async (req, res) => {
  res.json({ status: "ok" });
});

// ==================== API ROUTES ====================

app.use("/api/employees", employeesRoutes);
app.use("/api/trains", trainsRoutes);
app.use("/api/duty-sheets", dutySheetsRoutes);
app.use("/api/seed", seedRoutes);
app.use("/api/batches", batchesRoutes);
app.use("/api/backup", backupRoutes);

// ==================== REACT FRONTEND ====================

const frontendPath = path.join(__dirname, "../../FRONTEND/dist");

app.use(express.static(frontendPath));

// Any route that doesn't start with /api will serve React
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ==================== PROCESS HANDLERS ====================

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// ==================== APPLY SCHEMA ====================

async function applySchema() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  if (pool) {
    const client = await pool.connect();

    try {
      await client.query(schemaSql);
      console.log("✅ Schema applied/verified.");
    } finally {
      client.release();
    }
  } else {
    const { Pool } = require("@neondatabase/serverless");

    const neonPool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
    });

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

// ==================== START SERVER ====================

async function startServer() {
  await testConnection();
  await applySchema();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 OTA Manager running`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📡 LAN: http://<YOUR-IP>:${PORT}`);
  });
}

startServer();
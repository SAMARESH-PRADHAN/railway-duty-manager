require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { testConnection } = require("./lib/db");

const employeesRoutes = require("./routes/employees.routes");
const trainsRoutes = require("./routes/trains.routes");
const dutySheetsRoutes = require("./routes/duty-sheets.routes");
const seedRoutes = require("./routes/seed.routes");

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

// Start server only after database connection is successful
async function startServer() {
  await testConnection();

  app.listen(PORT, () => {
    console.log(`🚀 OTA Manager backend running on http://localhost:${PORT}`);
  });
}

startServer();
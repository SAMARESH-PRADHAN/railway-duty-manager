// Applies sql/schema.sql to the database at DATABASE_URL.
// Uses the Pool client (not the tagged-template `sql` helper) because
// schema.sql contains multiple semicolon-separated statements, which the
// lightweight `neon()` tagged-template client does not support in one call.
// Usage: node scripts/migrate.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("@neondatabase/serverless");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  console.log("Applying schema.sql ...");
  const client = await pool.connect();
  try {
    await client.query(schemaSql);
    console.log("Schema applied successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

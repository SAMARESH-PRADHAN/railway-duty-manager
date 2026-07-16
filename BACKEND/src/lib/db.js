const { neon } = require("@neondatabase/serverless");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Tagged-template SQL client
const sql = neon(process.env.DATABASE_URL);

// Test database connection
async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed.");
    console.error(error.message);
    process.exit(1); // Stop the server if DB connection fails
  }
}

module.exports = {
  sql,
  testConnection,
};
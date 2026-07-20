//======================================================FOR CLOUDE DATABASE (NEON CONSOLE)=============================================


// const { neon } = require("@neondatabase/serverless");

// if (!process.env.DATABASE_URL) {
//   throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
// }

// // Tagged-template SQL client
// const sql = neon(process.env.DATABASE_URL);

// // Test database connection
// async function testConnection() {
//   try {
//     await sql`SELECT 1`;
//     console.log("✅ Database connected successfully.");
//   } catch (error) {
//     console.error("❌ Database connection failed.");
//     console.error(error.message);
//     process.exit(1); // Stop the server if DB connection fails
//   }
// }

// module.exports = {
//   sql,
//   testConnection,
// };





//====================================================FOR LOCAL STORAGE(POSTGRESQL)======================================================


require("dotenv").config();

const driver = process.env.DB_DRIVER || "local";

const connectionString =
  driver === "neon" ? process.env.NEON_DATABASE_URL : process.env.LOCAL_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    `${driver === "neon" ? "NEON_DATABASE_URL" : "LOCAL_DATABASE_URL"} is not set. Copy .env.example to .env and fill it in.`
  );
}

let sql;
let pool;

if (driver === "neon") {
  const { neon } = require("@neondatabase/serverless");
  sql = neon(connectionString);
  console.log("🌐 Using Neon serverless driver");
} else {
  const { Pool } = require("pg");
  pool = new Pool({ connectionString });

  // Mimic Neon's tagged-template `sql` function using pg under the hood
  sql = function (strings, ...values) {
    const text = strings.reduce((prev, curr, i) => prev + `$${i}` + curr);
    return pool.query(text, values).then((res) => res.rows);
  };
  console.log("💻 Using local Postgres driver (pg)");
}

async function testConnection() {
  try {
    await sql`SELECT 1`;
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed.");
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  sql,
  pool,
  testConnection,
};
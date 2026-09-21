const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "uvesms",   // ← your DB name
  password: "1234", // change if needed
  port: 5432,
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL (uvesms)"))
  .catch(err => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });

module.exports = pool;
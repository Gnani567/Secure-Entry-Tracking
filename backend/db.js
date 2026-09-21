const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "uvesms",
  password: "1234",
  port: 5432,
});

pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL (uvesms)"))
  .catch(err => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });

module.exports = pool;
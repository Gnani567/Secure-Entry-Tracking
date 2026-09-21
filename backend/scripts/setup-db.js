// scripts/setup-db.js
// Run with: node scripts/setup-db.js
// Sets up the database schema and seeds demo users.

const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");
const path     = require("path");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user:     process.env.DB_USER     || "postgres",
        host:     process.env.DB_HOST     || "localhost",
        database: process.env.DB_NAME     || "uvesms",
        password: process.env.DB_PASSWORD || "1234",
        port:     Number(process.env.DB_PORT) || 5432,
      }
);

async function setup() {
  console.log("🔧  Setting up UVESMS database...\n");

  // ── Create tables ──────────────────────────────────────────────────────────

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      user_id    VARCHAR(50)  UNIQUE NOT NULL,
      name       VARCHAR(100) NOT NULL,
      password   VARCHAR(255) NOT NULL,
      user_type  VARCHAR(20)  NOT NULL CHECK (user_type IN ('admin', 'security_staff')),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ users table");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      id         SERIAL PRIMARY KEY,
      user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_name VARCHAR(100) NOT NULL,
      email      VARCHAR(150),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ admin table");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_staff (
      id            SERIAL PRIMARY KEY,
      staff_id      VARCHAR(20)  UNIQUE NOT NULL,
      staff_name    VARCHAR(100) NOT NULL,
      gate_assigned VARCHAR(50),
      user_id       INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ security_staff table");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitors (
      id              SERIAL PRIMARY KEY,
      visitor_name    VARCHAR(100) NOT NULL,
      phone_number    VARCHAR(20)  NOT NULL,
      id_proof_type   VARCHAR(50)  NOT NULL,
      id_proof_number VARCHAR(100) NOT NULL,
      department      VARCHAR(100),
      visitor_status  VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (visitor_status IN ('active', 'inactive')),
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ visitors table");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS entry_logs (
      id               SERIAL PRIMARY KEY,
      visitor_id       INT          NOT NULL REFERENCES visitors(id),
      staff_id         INT          REFERENCES security_staff(id),
      visit_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
      entry_time       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      exit_time        TIMESTAMPTZ,
      purpose_of_visit TEXT         NOT NULL,
      host_name        VARCHAR(100),
      gate_number      VARCHAR(50),
      pass_number      VARCHAR(100) UNIQUE,
      status           VARCHAR(20)  NOT NULL DEFAULT 'inside'
                         CHECK (status IN ('inside', 'exited')),
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  console.log("  ✓ entry_logs table");

  // Indexes
  await pool.query("CREATE INDEX IF NOT EXISTS idx_entry_logs_visitor_id ON entry_logs(visitor_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_entry_logs_visit_date  ON entry_logs(visit_date)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_entry_logs_status      ON entry_logs(status)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_visitors_name          ON visitors(visitor_name)");
  console.log("  ✓ indexes");

  // ── Seed demo users ────────────────────────────────────────────────────────

  const adminHash = await bcrypt.hash("admin123", 10);
  const secHash   = await bcrypt.hash("sec123",   10);

  const seeds = [
    { userId: "ADMIN001", name: "Administrator", password: adminHash, userType: "admin" },
    { userId: "SEC001",   name: "Rajan K",       password: secHash,   userType: "security_staff" },
    { userId: "SEC002",   name: "Suresh M",      password: secHash,   userType: "security_staff" },
    { userId: "SEC003",   name: "Anjali P",      password: secHash,   userType: "security_staff" },
  ];

  for (const s of seeds) {
    const { rows } = await pool.query(
      `INSERT INTO users (user_id, name, password, user_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [s.userId, s.name, s.password, s.userType]
    );
    const dbId = rows[0].id;

    if (s.userType === "admin") {
      await pool.query(
        `INSERT INTO admin (user_id, admin_name, email)
         VALUES ($1, $2, 'admin@nitc.ac.in')
         ON CONFLICT DO NOTHING`,
        [dbId, s.name]
      );
    } else {
      const gateMap = { SEC001: "Gate 1", SEC002: "Gate 2", SEC003: "Gate 3" };
      await pool.query(
        `INSERT INTO security_staff (staff_id, staff_name, gate_assigned, user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (staff_id) DO UPDATE SET staff_name = EXCLUDED.staff_name`,
        [s.userId, s.name, gateMap[s.userId] || null, dbId]
      );
    }

    console.log(`  ✓ seeded user ${s.userId}`);
  }

  console.log("\n✅  Database setup complete!");
  console.log("\n  Demo credentials:");
  console.log("    Admin:  ADMIN001 / admin123");
  console.log("    Staff:  SEC001   / sec123");
  console.log("    Staff:  SEC002   / sec123\n");
}

setup()
  .catch((err) => {
    console.error("\n❌  Setup failed:", err.message);
    console.error("\n  Make sure PostgreSQL is running and the database exists.");
    console.error("  Create it with: createdb uvesms\n");
    process.exit(1);
  })
  .finally(() => pool.end());

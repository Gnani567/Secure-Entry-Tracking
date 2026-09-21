-- =============================================================================
-- Secure Entry Tracking (SET) — PostgreSQL Schema
-- Previously: UVESMS (University Visitor Entry & Security Management System)
--
-- Usage:
--   psql -U postgres -c "CREATE DATABASE set_db;"
--   psql -U postgres -d set_db -f schema.sql
-- =============================================================================


-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Base authentication table; every system user (admin or security staff)
-- has exactly one row here plus a row in their role-specific profile table.
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL        PRIMARY KEY,
  user_id    VARCHAR(50)   UNIQUE NOT NULL,  -- login ID  e.g. ADMIN001, SEC001
  name       VARCHAR(100)  NOT NULL,
  password   VARCHAR(255)  NOT NULL,          -- bcrypt hash
  user_type  VARCHAR(20)   NOT NULL
               CHECK (user_type IN ('admin', 'security_staff')),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Admin profile; one row per admin linked to users(id).
CREATE TABLE IF NOT EXISTS admin (
  id         SERIAL        PRIMARY KEY,
  user_id    INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_name VARCHAR(100)  NOT NULL,
  email      VARCHAR(150),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Security staff profile; one row per officer linked to users(id).
CREATE TABLE IF NOT EXISTS security_staff (
  id            SERIAL       PRIMARY KEY,
  staff_id      VARCHAR(20)  UNIQUE NOT NULL,   -- e.g. SEC001
  staff_name    VARCHAR(100) NOT NULL,
  gate_assigned VARCHAR(50),
  user_id       INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Visitor registry; one row per unique visitor registered in the system.
CREATE TABLE IF NOT EXISTS visitors (
  id              SERIAL        PRIMARY KEY,
  visitor_name    VARCHAR(100)  NOT NULL,
  phone_number    VARCHAR(20)   NOT NULL,
  id_proof_type   VARCHAR(50)   NOT NULL,
  id_proof_number VARCHAR(100)  NOT NULL,
  department      VARCHAR(100),
  visitor_status  VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (visitor_status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Entry / exit log; one row per campus visit.
-- staff_id is set to NULL if the officer who created the entry is later removed.
CREATE TABLE IF NOT EXISTS entry_logs (
  id               SERIAL        PRIMARY KEY,
  visitor_id       INT           NOT NULL REFERENCES visitors(id),
  staff_id         INT           REFERENCES security_staff(id) ON DELETE SET NULL,
  visit_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  entry_time       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  exit_time        TIMESTAMPTZ,
  purpose_of_visit TEXT          NOT NULL,
  host_name        VARCHAR(100),
  gate_number      VARCHAR(50),
  pass_number      VARCHAR(100)  UNIQUE,
  status           VARCHAR(20)   NOT NULL DEFAULT 'inside'
                     CHECK (status IN ('inside', 'exited')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entry_logs_visitor_id ON entry_logs(visitor_id);
CREATE INDEX IF NOT EXISTS idx_entry_logs_visit_date ON entry_logs(visit_date);
CREATE INDEX IF NOT EXISTS idx_entry_logs_status     ON entry_logs(status);
CREATE INDEX IF NOT EXISTS idx_visitors_name         ON visitors(visitor_name);
CREATE INDEX IF NOT EXISTS idx_visitors_phone        ON visitors(phone_number);


-- ─── Seed Data ───────────────────────────────────────────────────────────────
-- Password hashes:
--   admin123  →  $2a$10$N.X7Z2F7lNSMy2U0E7X8iuTWGsL0rENZBCF5vY/XGpSK2HuQ6UXMO
--   sec123    →  $2a$10$4Wd2/GJmO7w1pGYVEiRxS.ZHsUJFPpj5.NckB9Ix2NBIL5yQnhg7K

INSERT INTO users (user_id, name, password, user_type) VALUES
  ('ADMIN001', 'Administrator', '$2a$10$N.X7Z2F7lNSMy2U0E7X8iuTWGsL0rENZBCF5vY/XGpSK2HuQ6UXMO', 'admin'),
  ('SEC001',   'Rajan K',       '$2a$10$4Wd2/GJmO7w1pGYVEiRxS.ZHsUJFPpj5.NckB9Ix2NBIL5yQnhg7K', 'security_staff'),
  ('SEC002',   'Suresh M',      '$2a$10$4Wd2/GJmO7w1pGYVEiRxS.ZHsUJFPpj5.NckB9Ix2NBIL5yQnhg7K', 'security_staff'),
  ('SEC003',   'Anjali P',      '$2a$10$4Wd2/GJmO7w1pGYVEiRxS.ZHsUJFPpj5.NckB9Ix2NBIL5yQnhg7K', 'security_staff')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO admin (user_id, admin_name, email)
  SELECT id, 'Administrator', 'admin@nitc.ac.in' FROM users WHERE user_id = 'ADMIN001'
ON CONFLICT DO NOTHING;

INSERT INTO security_staff (staff_id, staff_name, gate_assigned, user_id)
  SELECT 'SEC001', 'Rajan K',  'Gate 1', id FROM users WHERE user_id = 'SEC001'
ON CONFLICT (staff_id) DO NOTHING;

INSERT INTO security_staff (staff_id, staff_name, gate_assigned, user_id)
  SELECT 'SEC002', 'Suresh M', 'Gate 2', id FROM users WHERE user_id = 'SEC002'
ON CONFLICT (staff_id) DO NOTHING;

INSERT INTO security_staff (staff_id, staff_name, gate_assigned, user_id)
  SELECT 'SEC003', 'Anjali P', 'Gate 3', id FROM users WHERE user_id = 'SEC003'
ON CONFLICT (staff_id) DO NOTHING;

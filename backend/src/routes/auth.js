// =============================================================================
// auth.js — Authentication Routes
// POST /login  — sign in and receive a JWT
// GET  /me     — return the current user's profile
// =============================================================================

const { Router }  = require("express");
const bcrypt      = require("bcryptjs");
const jwt         = require("jsonwebtoken");
const pool        = require("../../db");
const { requireAuth } = require("../middlewares/auth");

const router     = Router();
const JWT_SECRET = process.env.JWT_SECRET || "uvesms-secret-key-2024";
const JWT_TTL    = "8h";

// ─── POST /login ─────────────────────────────────────────────────────────────
// Body: { userId, password, role }
// Returns: { token, user: { userId, name, role, email?, gateAssigned? } }
//
// BUG FIX: the `role` field sent by the frontend is now validated against the
// user's actual user_type stored in the database.  Previously the backend
// ignored it, allowing a security officer to authenticate via the Admin tab.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { userId, password, role } = req.body;

    // ── Validate input ─────────────────────────────────────────────────────
    if (!userId || !password) {
      return res.status(400).json({ error: "userId and password are required" });
    }

    // ── Look up the user ───────────────────────────────────────────────────
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE user_id = $1",
      [userId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── Verify password ────────────────────────────────────────────────────
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // ── BUG FIX: Validate role matches the account type ────────────────────
    // If the frontend specifies a role, it must match what is in the database.
    // This prevents a security officer logging in through the Admin tab.
    if (role && role !== user.user_type) {
      return res.status(403).json({
        error: `This account is not registered as ${role === "admin" ? "an Administrator" : "a Security Officer"}`,
      });
    }

    // ── Fetch extended profile ─────────────────────────────────────────────
    let name        = user.name;
    let gateAssigned = null;
    let email        = null;

    if (user.user_type === "admin") {
      const { rows: adminRows } = await pool.query(
        "SELECT admin_name, email FROM admin WHERE user_id = $1",
        [user.id]
      );
      if (adminRows[0]) {
        name  = adminRows[0].admin_name;
        email = adminRows[0].email;
      }
    } else if (user.user_type === "security_staff") {
      const { rows: staffRows } = await pool.query(
        "SELECT staff_name, gate_assigned FROM security_staff WHERE user_id = $1",
        [user.id]
      );
      if (staffRows[0]) {
        name         = staffRows[0].staff_name;
        gateAssigned = staffRows[0].gate_assigned;
      }
    }

    // ── Issue JWT ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { userId: user.user_id, role: user.user_type, dbId: user.id },
      JWT_SECRET,
      { expiresIn: JWT_TTL }
    );

    return res.json({
      token,
      user: {
        userId: user.user_id,
        name,
        role:         user.user_type,
        email,
        gateAssigned,
      },
    });
  } catch (err) {
    console.error("POST /login error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────
// Requires: Bearer token in Authorization header
// Returns: current user's profile
// ─────────────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.dbId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    let name         = user.name;
    let gateAssigned = null;
    let email        = null;

    if (user.user_type === "admin") {
      const { rows: adminRows } = await pool.query(
        "SELECT admin_name, email FROM admin WHERE user_id = $1",
        [user.id]
      );
      if (adminRows[0]) {
        name  = adminRows[0].admin_name;
        email = adminRows[0].email;
      }
    } else if (user.user_type === "security_staff") {
      const { rows: staffRows } = await pool.query(
        "SELECT staff_name, gate_assigned FROM security_staff WHERE user_id = $1",
        [user.id]
      );
      if (staffRows[0]) {
        name         = staffRows[0].staff_name;
        gateAssigned = staffRows[0].gate_assigned;
      }
    }

    return res.json({
      userId:       user.user_id,
      name,
      role:         user.user_type,
      email,
      gateAssigned,
    });
  } catch (err) {
    console.error("GET /me error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Alias: frontend calls GET /api/auth/me — delegate to the handler above
router.get("/auth/me", requireAuth, (req, res, next) => {
  req.url = "/me";
  router.handle(req, res, next);
});

module.exports = router;

// =============================================================================
// securityStaff.js — Security Staff Routes
//
// GET    /api/security-staff           — list all staff (any authenticated user)
// POST   /api/security-staff           — create staff  (admin only)
// GET    /api/security-staff/:id       — get one staff  (any authenticated user)
// PATCH  /api/security-staff/:id       — update staff  (admin only)
// DELETE /api/security-staff/:id       — remove staff  (admin only)
// =============================================================================

const { Router } = require("express");
const bcrypt     = require("bcryptjs");
const pool       = require("../../db");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = Router();

// ─── GET /api/security-staff ─────────────────────────────────────────────────
router.get("/security-staff", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ss.id,
        ss.staff_id,
        ss.staff_name,
        ss.gate_assigned,
        ss.created_at,
        u.user_id
      FROM security_staff ss
      JOIN users u ON u.id = ss.user_id
      ORDER BY ss.staff_id
    `);

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM security_staff"
    );

    return res.json({
      staff: rows.map(toStaffJson),
      total: countRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /security-staff error:", err.message);
    return res.status(500).json({ error: "Failed to fetch security staff" });
  }
});

// ─── POST /api/security-staff ────────────────────────────────────────────────
router.post("/security-staff", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { staffName, password, gateAssigned } = req.body;

    if (!staffName || !password) {
      return res.status(400).json({ error: "staffName and password are required" });
    }

    // Auto-generate a sequential staff ID (e.g. SEC004)
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM security_staff"
    );
    const staffId = `SEC${String((countRows[0]?.count ?? 0) + 1).padStart(3, "0")}`;

    // Guard against ID collision on concurrent inserts
    const { rows: existing } = await pool.query(
      "SELECT id FROM security_staff WHERE staff_id = $1",
      [staffId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `Staff ID ${staffId} already exists` });
    }

    // Create the users row first
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: userRows } = await pool.query(
      `INSERT INTO users (user_id, name, password, user_type)
       VALUES ($1, $2, $3, 'security_staff')
       RETURNING *`,
      [staffId, staffName, hashedPassword]
    );
    const newUser = userRows[0];

    // Create the security_staff profile linked to that user
    const { rows: staffRows } = await pool.query(
      `INSERT INTO security_staff (staff_id, staff_name, gate_assigned, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [staffId, staffName, gateAssigned || null, newUser.id]
    );

    return res.status(201).json(toStaffJson({ ...staffRows[0], user_id: newUser.user_id }));
  } catch (err) {
    console.error("POST /security-staff error:", err.message);
    return res.status(500).json({ error: "Failed to create staff member" });
  }
});

// ─── GET /api/security-staff/:id ─────────────────────────────────────────────
router.get("/security-staff/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ss.*, u.user_id
       FROM security_staff ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.id = $1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    return res.json(toStaffJson(rows[0]));
  } catch (err) {
    console.error("GET /security-staff/:id error:", err.message);
    return res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

// ─── PATCH /api/security-staff/:id ───────────────────────────────────────────
router.patch("/security-staff/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { staffName, gateAssigned, password } = req.body;

    const { rows: existing } = await pool.query(
      "SELECT * FROM security_staff WHERE id = $1",
      [req.params.id]
    );
    if (!existing[0]) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const current = existing[0];
    const newName = staffName    ?? current.staff_name;
    const newGate = gateAssigned !== undefined ? gateAssigned : current.gate_assigned;

    // Update security_staff profile
    const { rows: staffRows } = await pool.query(
      `UPDATE security_staff
       SET staff_name = $1, gate_assigned = $2
       WHERE id = $3
       RETURNING *`,
      [newName, newGate, req.params.id]
    );

    // Sync name to users table if changed
    if (staffName) {
      await pool.query(
        "UPDATE users SET name = $1 WHERE id = $2",
        [staffName, current.user_id]
      );
    }

    // Update password if provided
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hash, current.user_id]
      );
    }

    const { rows: userRows } = await pool.query(
      "SELECT user_id FROM users WHERE id = $1",
      [current.user_id]
    );

    return res.json(toStaffJson({ ...staffRows[0], user_id: userRows[0]?.user_id ?? "" }));
  } catch (err) {
    console.error("PATCH /security-staff/:id error:", err.message);
    return res.status(500).json({ error: "Failed to update staff member" });
  }
});

// ─── DELETE /api/security-staff/:id ──────────────────────────────────────────
//
// BUG FIX: entry_logs.staff_id has no ON DELETE CASCADE/SET NULL in the schema,
// so deleting the user (which cascades to security_staff) was blocked by the
// FK constraint.  We now explicitly null-out entry_logs.staff_id first so the
// historical log records are preserved but the staff record can be removed.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/security-staff/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM security_staff WHERE id = $1",
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const staffRecord = rows[0];

    // Step 1 — detach this staff member from any historical entry logs
    await pool.query(
      "UPDATE entry_logs SET staff_id = NULL WHERE staff_id = $1",
      [staffRecord.id]
    );

    // Step 2 — delete the user; the ON DELETE CASCADE on security_staff.user_id
    //           will automatically remove the security_staff row as well.
    await pool.query(
      "DELETE FROM users WHERE id = $1",
      [staffRecord.user_id]
    );

    return res.sendStatus(204);
  } catch (err) {
    console.error("DELETE /security-staff/:id error:", err.message);
    return res.status(500).json({ error: "Failed to delete staff member" });
  }
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function toStaffJson(row) {
  return {
    id:           row.id,
    staffId:      row.staff_id,
    staffName:    row.staff_name,
    gateAssigned: row.gate_assigned,
    userId:       row.user_id,
    createdAt:    row.created_at,
  };
}

module.exports = router;

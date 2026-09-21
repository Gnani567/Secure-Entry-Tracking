const { Router } = require("express");
const pool = require("../../db");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = Router();

// ─── GET /api/visitors ───────────────────────────────────────────────────────
// Query params: search, page, limit
router.get("/visitors", requireAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query, countQuery, params;

    if (search) {
      const pattern = `%${search}%`;
      query = `
        SELECT * FROM visitors
        WHERE visitor_name ILIKE $1
           OR phone_number ILIKE $1
           OR id_proof_number ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      countQuery = `
        SELECT COUNT(*)::int AS count FROM visitors
        WHERE visitor_name ILIKE $1
           OR phone_number ILIKE $1
           OR id_proof_number ILIKE $1
      `;
      params = [pattern, Number(limit), offset];
    } else {
      query = `
        SELECT * FROM visitors
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `SELECT COUNT(*)::int AS count FROM visitors`;
      params = [Number(limit), offset];
    }

    const { rows: visitors } = await pool.query(query, params);
    const { rows: countRows } = await pool.query(
      countQuery,
      search ? [`%${search}%`] : []
    );

    // Map snake_case → camelCase for the frontend
    res.json({
      visitors: visitors.map(toVisitorJson),
      total: countRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /visitors error:", err.message);
    res.status(500).json({ error: "Failed to fetch visitors" });
  }
});

// ─── POST /api/visitors ──────────────────────────────────────────────────────
router.post("/visitors", requireAuth, async (req, res) => {
  try {
    const { visitorName, phoneNumber, idProofType, idProofNumber, department } = req.body;

    if (!visitorName || !phoneNumber || !idProofType || !idProofNumber) {
      return res.status(400).json({
        error: "visitorName, phoneNumber, idProofType, and idProofNumber are required",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO visitors (visitor_name, phone_number, id_proof_type, id_proof_number, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [visitorName, phoneNumber, idProofType, idProofNumber, department || null]
    );

    res.status(201).json(toVisitorJson(rows[0]));
  } catch (err) {
    console.error("POST /visitors error:", err.message);
    res.status(500).json({ error: "Failed to create visitor" });
  }
});

// ─── GET /api/visitors/:id ───────────────────────────────────────────────────
router.get("/visitors/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM visitors WHERE id = $1",
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    res.json(toVisitorJson(rows[0]));
  } catch (err) {
    console.error("GET /visitors/:id error:", err.message);
    res.status(500).json({ error: "Failed to fetch visitor" });
  }
});

// ─── PATCH /api/visitors/:id ─────────────────────────────────────────────────
router.patch("/visitors/:id", requireAuth, async (req, res) => {
  try {
    const { visitorName, phoneNumber, idProofType, idProofNumber, department, visitorStatus } = req.body;

    const { rows: existing } = await pool.query(
      "SELECT * FROM visitors WHERE id = $1",
      [req.params.id]
    );
    if (!existing[0]) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    const current = existing[0];
    const { rows } = await pool.query(
      `UPDATE visitors
       SET visitor_name    = $1,
           phone_number    = $2,
           id_proof_type   = $3,
           id_proof_number = $4,
           department      = $5,
           visitor_status  = $6
       WHERE id = $7
       RETURNING *`,
      [
        visitorName    ?? current.visitor_name,
        phoneNumber    ?? current.phone_number,
        idProofType    ?? current.id_proof_type,
        idProofNumber  ?? current.id_proof_number,
        department     ?? current.department,
        visitorStatus  ?? current.visitor_status,
        req.params.id,
      ]
    );

    res.json(toVisitorJson(rows[0]));
  } catch (err) {
    console.error("PATCH /visitors/:id error:", err.message);
    res.status(500).json({ error: "Failed to update visitor" });
  }
});

// ─── PATCH /api/visitors/:id/approve ────────────────────────────────────────
router.patch("/visitors/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== "approve" && action !== "block") {
      return res.status(400).json({ error: "action must be 'approve' or 'block'" });
    }

    const newStatus = action === "approve" ? "active" : "inactive";
    const { rows } = await pool.query(
      "UPDATE visitors SET visitor_status = $1 WHERE id = $2 RETURNING *",
      [newStatus, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    res.json(toVisitorJson(rows[0]));
  } catch (err) {
    console.error("PATCH /visitors/:id/approve error:", err.message);
    res.status(500).json({ error: "Failed to update visitor status" });
  }
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function toVisitorJson(row) {
  return {
    id:             row.id,
    visitorName:    row.visitor_name,
    phoneNumber:    row.phone_number,
    idProofType:    row.id_proof_type,
    idProofNumber:  row.id_proof_number,
    department:     row.department,
    visitorStatus:  row.visitor_status,
    createdAt:      row.created_at,
  };
}

module.exports = router;

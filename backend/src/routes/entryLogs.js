const { Router } = require("express");
const pool = require("../../db");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

// ─── GET /api/entry-logs ─────────────────────────────────────────────────────
// Query params: status, date, visitorId, page, limit
router.get("/entry-logs", requireAuth, async (req, res) => {
  try {
    const { status, date, visitorId, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const params = [];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`el.status = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`el.visit_date = $${params.length}`);
    }
    if (visitorId) {
      params.push(Number(visitorId));
      conditions.push(`el.visitor_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(Number(limit));
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const { rows: logs } = await pool.query(
      `SELECT
         el.*,
         v.visitor_name,
         ss.staff_name
       FROM entry_logs el
       LEFT JOIN visitors v        ON v.id  = el.visitor_id
       LEFT JOIN security_staff ss ON ss.id = el.staff_id
       ${where}
       ORDER BY el.entry_time DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    // Count query (no limit/offset)
    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM entry_logs el
       ${where}`,
      countParams
    );

    res.json({
      logs: logs.map(toLogJson),
      total: countRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /entry-logs error:", err.message);
    res.status(500).json({ error: "Failed to fetch entry logs" });
  }
});

// ─── POST /api/entry-logs ────────────────────────────────────────────────────
router.post("/entry-logs", requireAuth, async (req, res) => {
  try {
    const { visitorId, purposeOfVisit, hostName, gateNumber } = req.body;

    if (!visitorId || !purposeOfVisit) {
      return res.status(400).json({ error: "visitorId and purposeOfVisit are required" });
    }

    // Verify visitor exists
    const { rows: visitorRows } = await pool.query(
      "SELECT id FROM visitors WHERE id = $1",
      [visitorId]
    );
    if (!visitorRows[0]) {
      return res.status(404).json({ error: "Visitor not found" });
    }

    // Resolve staff ID from logged-in user
    let staffId = null;
    if (req.user?.role === "security_staff") {
      const { rows: staffRows } = await pool.query(
        "SELECT id FROM security_staff WHERE staff_id = $1",
        [req.user.userId]
      );
      staffId = staffRows[0]?.id ?? null;
    }

    const passNumber = `PASS-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
    const today = new Date().toISOString().split("T")[0];

    const { rows } = await pool.query(
      `INSERT INTO entry_logs
         (visitor_id, staff_id, visit_date, entry_time, purpose_of_visit, host_name, gate_number, pass_number, status)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, 'inside')
       RETURNING *`,
      [visitorId, staffId, today, purposeOfVisit, hostName || null, gateNumber || null, passNumber]
    );

    const { rows: enriched } = await pool.query(
      `SELECT el.*, v.visitor_name, ss.staff_name
       FROM entry_logs el
       LEFT JOIN visitors v        ON v.id  = el.visitor_id
       LEFT JOIN security_staff ss ON ss.id = el.staff_id
       WHERE el.id = $1`,
      [rows[0].id]
    );

    res.status(201).json(toLogJson(enriched[0]));
  } catch (err) {
    console.error("POST /entry-logs error:", err.message);
    res.status(500).json({ error: "Failed to create entry log" });
  }
});

// ─── GET /api/entry-logs/:id ─────────────────────────────────────────────────
router.get("/entry-logs/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT el.*, v.visitor_name, ss.staff_name
       FROM entry_logs el
       LEFT JOIN visitors v        ON v.id  = el.visitor_id
       LEFT JOIN security_staff ss ON ss.id = el.staff_id
       WHERE el.id = $1`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Entry log not found" });
    }

    res.json(toLogJson(rows[0]));
  } catch (err) {
    console.error("GET /entry-logs/:id error:", err.message);
    res.status(500).json({ error: "Failed to fetch entry log" });
  }
});

// ─── PATCH /api/entry-logs/:id/exit ──────────────────────────────────────────
router.patch("/entry-logs/:id/exit", requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT * FROM entry_logs WHERE id = $1",
      [req.params.id]
    );

    if (!existing[0]) {
      return res.status(404).json({ error: "Entry log not found" });
    }
    if (existing[0].status === "exited") {
      return res.status(400).json({ error: "Exit already recorded for this entry" });
    }

    const { rows } = await pool.query(
      `UPDATE entry_logs
       SET exit_time = NOW(), status = 'exited'
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    const { rows: enriched } = await pool.query(
      `SELECT el.*, v.visitor_name, ss.staff_name
       FROM entry_logs el
       LEFT JOIN visitors v        ON v.id  = el.visitor_id
       LEFT JOIN security_staff ss ON ss.id = el.staff_id
       WHERE el.id = $1`,
      [rows[0].id]
    );

    res.json(toLogJson(enriched[0]));
  } catch (err) {
    console.error("PATCH /entry-logs/:id/exit error:", err.message);
    res.status(500).json({ error: "Failed to record exit" });
  }
});

// ─── POST /api/entry-logs/:id/reset-pass ─────────────────────────────────────
router.post("/entry-logs/:id/reset-pass", requireAuth, async (req, res) => {
  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM entry_logs WHERE id = $1",
      [req.params.id]
    );

    if (!existing[0]) {
      return res.status(404).json({ error: "Entry log not found" });
    }

    const newPass = `PASS-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const { rows } = await pool.query(
      "UPDATE entry_logs SET pass_number = $1 WHERE id = $2 RETURNING id, pass_number",
      [newPass, req.params.id]
    );

    res.json({ logId: rows[0].id, passNumber: rows[0].pass_number });
  } catch (err) {
    console.error("POST /entry-logs/:id/reset-pass error:", err.message);
    res.status(500).json({ error: "Failed to reset pass" });
  }
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function toLogJson(row) {
  return {
    id:             row.id,
    visitorId:      row.visitor_id,
    staffId:        row.staff_id,
    visitDate:      row.visit_date,
    entryTime:      row.entry_time,
    exitTime:       row.exit_time,
    purposeOfVisit: row.purpose_of_visit,
    hostName:       row.host_name,
    gateNumber:     row.gate_number,
    passNumber:     row.pass_number,
    status:         row.status,
    createdAt:      row.created_at,
    visitorName:    row.visitor_name ?? null,
    staffName:      row.staff_name   ?? null,
  };
}

module.exports = router;

const { Router } = require("express");
const pool = require("../../db");
const { requireAuth } = require("../middlewares/auth");

const router = Router();

// ─── GET /api/dashboard/stats ────────────────────────────────────────────────
router.get("/dashboard/stats", requireAuth, async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [todayResult, insideResult, exitedTodayResult, staffResult] =
      await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS count FROM entry_logs WHERE visit_date = $1",
          [today]
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM entry_logs WHERE status = 'inside'"
        ),
        pool.query(
          "SELECT COUNT(*)::int AS count FROM entry_logs WHERE visit_date = $1 AND status = 'exited'",
          [today]
        ),
        pool.query("SELECT COUNT(*)::int AS count FROM security_staff"),
      ]);

    res.json({
      totalVisitorsToday:      todayResult.rows[0]?.count       ?? 0,
      visitorsCurrentlyInside: insideResult.rows[0]?.count      ?? 0,
      totalExitedToday:        exitedTodayResult.rows[0]?.count ?? 0,
      totalSecurityStaff:      staffResult.rows[0]?.count       ?? 0,
    });
  } catch (err) {
    console.error("GET /dashboard/stats error:", err.message);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// ─── GET /api/dashboard/recent-activity ──────────────────────────────────────
router.get("/dashboard/recent-activity", requireAuth, async (_req, res) => {
  try {
    // Recent entries
    const { rows: entries } = await pool.query(`
      SELECT el.id, v.visitor_name, el.purpose_of_visit, el.gate_number,
             el.entry_time AS timestamp, 'entered' AS action
      FROM entry_logs el
      LEFT JOIN visitors v ON v.id = el.visitor_id
      ORDER BY el.entry_time DESC
      LIMIT 10
    `);

    // Recent exits
    const { rows: exits } = await pool.query(`
      SELECT el.id + 100000 AS id, v.visitor_name, el.purpose_of_visit, el.gate_number,
             el.exit_time AS timestamp, 'exited' AS action
      FROM entry_logs el
      LEFT JOIN visitors v ON v.id = el.visitor_id
      WHERE el.status = 'exited' AND el.exit_time IS NOT NULL
      ORDER BY el.exit_time DESC
      LIMIT 10
    `);

    // Merge, sort by timestamp desc, take top 10
    const combined = [...entries, ...exits]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map((r) => ({
        id:             r.id,
        visitorName:    r.visitor_name,
        purposeOfVisit: r.purpose_of_visit,
        gateNumber:     r.gate_number,
        timestamp:      r.timestamp,
        action:         r.action,
      }));

    res.json({ activities: combined });
  } catch (err) {
    console.error("GET /dashboard/recent-activity error:", err.message);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

// ─── GET /api/dashboard/visitors-inside ──────────────────────────────────────
router.get("/dashboard/visitors-inside", requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        el.id, el.visitor_id, el.staff_id, el.visit_date,
        el.entry_time, el.exit_time, el.purpose_of_visit,
        el.host_name, el.gate_number, el.pass_number, el.status,
        v.visitor_name
      FROM entry_logs el
      LEFT JOIN visitors v ON v.id = el.visitor_id
      WHERE el.status = 'inside'
      ORDER BY el.entry_time DESC
    `);

    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM entry_logs WHERE status = 'inside'"
    );

    res.json({
      logs: rows.map((r) => ({
        id:             r.id,
        visitorId:      r.visitor_id,
        staffId:        r.staff_id,
        visitDate:      r.visit_date,
        entryTime:      r.entry_time,
        exitTime:       r.exit_time,
        purposeOfVisit: r.purpose_of_visit,
        hostName:       r.host_name,
        gateNumber:     r.gate_number,
        passNumber:     r.pass_number,
        status:         r.status,
        visitorName:    r.visitor_name,
      })),
      total: countRows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /dashboard/visitors-inside error:", err.message);
    res.status(500).json({ error: "Failed to fetch visitors inside" });
  }
});

module.exports = router;

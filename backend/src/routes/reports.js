const { Router } = require("express");
const pool = require("../../db");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = Router();

// ─── GET /api/reports/visitors ────────────────────────────────────────────────
// Query params: startDate, endDate, gate, department
router.get("/reports/visitors", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, gate, department } = req.query;

    const conditions = [];
    const params = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`el.visit_date >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`el.visit_date <= $${params.length}`);
    }
    if (gate) {
      params.push(gate);
      conditions.push(`el.gate_number = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: logs } = await pool.query(
      `SELECT
         el.id, el.visit_date, el.entry_time, el.exit_time,
         el.purpose_of_visit, el.host_name, el.gate_number,
         el.pass_number, el.status,
         v.id          AS visitor_id,
         v.visitor_name,
         v.phone_number,
         v.id_proof_type,
         v.id_proof_number,
         v.department,
         ss.staff_name
       FROM entry_logs el
       LEFT JOIN visitors v        ON v.id  = el.visitor_id
       LEFT JOIN security_staff ss ON ss.id = el.staff_id
       ${where}
       ORDER BY el.visit_date ASC, el.entry_time ASC`,
      params
    );

    // Optional client-side department filter (case-insensitive)
    const filtered = department
      ? logs.filter((l) =>
          l.department?.toLowerCase().includes(department.toLowerCase())
        )
      : logs;

    const total         = filtered.length;
    const inside        = filtered.filter((l) => l.status === "inside").length;
    const exited        = filtered.filter((l) => l.status === "exited").length;
    const uniqueVisitors = new Set(filtered.map((l) => l.visitor_id)).size;

    res.json({
      summary: { total, inside, exited, uniqueVisitors },
      logs: filtered.map((l) => ({
        id:             l.id,
        visitDate:      l.visit_date,
        entryTime:      l.entry_time,
        exitTime:       l.exit_time,
        purposeOfVisit: l.purpose_of_visit,
        hostName:       l.host_name,
        gateNumber:     l.gate_number,
        passNumber:     l.pass_number,
        status:         l.status,
        visitorId:      l.visitor_id,
        visitorName:    l.visitor_name,
        phoneNumber:    l.phone_number,
        idProofType:    l.id_proof_type,
        idProofNumber:  l.id_proof_number,
        department:     l.department,
        staffName:      l.staff_name,
      })),
    });
  } catch (err) {
    console.error("GET /reports/visitors error:", err.message);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

module.exports = router;

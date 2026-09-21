// =============================================================================
// index.js — Secure Entry Tracking (SET) — Backend Entry Point
// =============================================================================

const express = require("express");
const cors    = require("cors");
const pool    = require("./db");

// ─── Route Modules ────────────────────────────────────────────────────────────
const authRoutes      = require("./src/routes/auth");
const visitorRoutes   = require("./src/routes/visitors");
const staffRoutes     = require("./src/routes/securityStaff");
const entryLogRoutes  = require("./src/routes/entryLogs");
const dashboardRoutes = require("./src/routes/dashboard");
const reportRoutes    = require("./src/routes/reports");

// ─── App Setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",  // Vite dev server
    "http://localhost:4173",  // Vite preview
    "http://localhost:3000",
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

// ─── Health Routes ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Secure Entry Tracking — backend running 🚀" });
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", database: err.message });
  }
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────
// The auth router handles:  POST /login  and  GET /me  (aliased as /auth/me)
// It is mounted at both "/" and "/api" so the frontend can reach it at:
//   POST /login        (Vite proxies this from the frontend)
//   POST /api/login    (direct API call)
//   GET  /api/auth/me  (session refresh)
app.use("/", authRoutes);
app.use("/api", authRoutes);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", visitorRoutes);
app.use("/api", staffRoutes);
app.use("/api", entryLogRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reportRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Secure Entry Tracking backend → http://localhost:${PORT}`);
});

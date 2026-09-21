// =============================================================================
// auth.js — Authentication & Authorization Middleware
// =============================================================================

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "uvesms-secret-key-2024";

// ─── requireAuth ──────────────────────────────────────────────────────────────
// Verifies the Bearer token from the Authorization header and attaches
// req.user = { userId, role, dbId } for downstream handlers.
// Returns 401 if the token is missing or invalid.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized — missing token" });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, dbId }
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────
// Must be used after requireAuth.
// Returns 403 if the logged-in user is not an admin.
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };

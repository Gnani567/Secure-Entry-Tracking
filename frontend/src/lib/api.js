// =============================================================================
// api.js — Central API Utility
//
// All requests to the backend go through apiFetch().
// Vite proxies /api/* and /login to http://localhost:5000 (see vite.config.js).
// Mock data is returned as a fallback when the backend is unreachable, so the
// UI remains usable during development without a running database.
// =============================================================================

const TOKEN_KEY = "set_token";

// ─── Token Helpers ────────────────────────────────────────────────────────────
export function getToken()         { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token)    { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken()       { localStorage.removeItem(TOKEN_KEY); }

// ─── Core Fetch ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(path, { ...options, headers });

  // Auto-clear a stale / expired token and signal AuthContext via a DOM event
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("auth:expired"));
    let message = "Session expired — please log in again";
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }

  return res.json();
}

// =============================================================================
// AUTH
// =============================================================================

// ─── login ───────────────────────────────────────────────────────────────────
// BUG FIX: `role` is now included in the request body.
// Previously it was received as a parameter but never forwarded to the backend,
// so the backend had no way to reject an officer logging in as an admin.
export async function login({ userId, password, role }) {
  try {
    return await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ userId, password, role }),
    });
  } catch (err) {
    // Re-throw real auth errors (401 / 403) — no mock fallback for these
    if (
      err.message.includes("Session expired") ||
      err.message.includes("Invalid credentials") ||
      err.message.includes("not registered as")
    ) {
      throw err;
    }

    // Network error — fall back to mock credentials for offline development
    return _mockLogin(userId, password, role);
  }
}

// ─── getMe ───────────────────────────────────────────────────────────────────
export async function getMe() {
  try {
    return await apiFetch("/api/auth/me");
  } catch (err) {
    // Re-throw auth errors so AuthContext can clear the session
    if (err.message.includes("Session expired") || err.message.includes("Unauthorized")) {
      throw err;
    }

    // Network error — decode the JWT payload locally to survive a page refresh
    return _decodeTokenPayload();
  }
}

// =============================================================================
// VISITORS
// =============================================================================

export async function listVisitors(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page)   query.set("page",   params.page);
    const qs = query.toString();
    return await apiFetch(`/api/visitors${qs ? `?${qs}` : ""}`);
  } catch {
    return { visitors: MOCK_VISITORS };
  }
}

export async function getVisitor(id) {
  try {
    return await apiFetch(`/api/visitors/${id}`);
  } catch {
    return MOCK_VISITORS.find((v) => v.id === id) || MOCK_VISITORS[0];
  }
}

export async function createVisitor(data) {
  return apiFetch("/api/visitors", { method: "POST", body: JSON.stringify(data) });
}

export async function approveVisitor(visitorId, action) {
  return apiFetch(`/api/visitors/${visitorId}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

// =============================================================================
// ENTRY LOGS
// =============================================================================

export async function listEntryLogs(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.status && params.status !== "all") query.set("status",    params.status);
    if (params.date)                               query.set("date",      params.date);
    if (params.visitorId)                          query.set("visitorId", params.visitorId);
    const qs = query.toString();
    return await apiFetch(`/api/entry-logs${qs ? `?${qs}` : ""}`);
  } catch {
    return { logs: MOCK_LOGS };
  }
}

export async function createEntryLog(data) {
  return apiFetch("/api/entry-logs", { method: "POST", body: JSON.stringify(data) });
}

export async function recordExit(logId) {
  return apiFetch(`/api/entry-logs/${logId}/exit`, { method: "PATCH" });
}

export async function resetPass(logId) {
  return apiFetch(`/api/entry-logs/${logId}/reset-pass`, { method: "POST" });
}

// =============================================================================
// SECURITY STAFF
// =============================================================================

export async function listSecurityStaff() {
  try {
    return await apiFetch("/api/security-staff");
  } catch {
    return { staff: MOCK_STAFF };
  }
}

export async function createSecurityStaff(data) {
  return apiFetch("/api/security-staff", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteSecurityStaff(id) {
  return apiFetch(`/api/security-staff/${id}`, { method: "DELETE" });
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getDashboardStats() {
  try {
    return await apiFetch("/api/dashboard/stats");
  } catch {
    return {
      visitorsCurrentlyInside: 3,
      totalVisitorsToday:      12,
      totalExitedToday:        9,
      totalSecurityStaff:      3,
    };
  }
}

export async function getRecentActivity() {
  try {
    return await apiFetch("/api/dashboard/recent-activity");
  } catch {
    return { activities: MOCK_ACTIVITY };
  }
}

export async function getVisitorsCurrentlyInside() {
  try {
    return await apiFetch("/api/dashboard/visitors-inside");
  } catch {
    return { logs: MOCK_LOGS.filter((l) => l.status === "inside") };
  }
}

// =============================================================================
// REPORTS
// =============================================================================

export async function fetchReport(params = {}) {
  try {
    const qs = new URLSearchParams(params).toString();
    return await apiFetch(`/api/reports/visitors${qs ? `?${qs}` : ""}`);
  } catch {
    return {
      logs: MOCK_LOGS,
      summary: {
        total:          MOCK_LOGS.length,
        inside:         MOCK_LOGS.filter((l) => l.status === "inside").length,
        exited:         MOCK_LOGS.filter((l) => l.status === "exited").length,
        uniqueVisitors: new Set(MOCK_LOGS.map((l) => l.visitorId)).size,
      },
    };
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const ID_PROOF_TYPES = ["Aadhar", "PAN", "Passport", "Driving License", "Voter ID"];

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

// Build a signed-looking mock JWT for offline/dev mode only.
// The backend will reject these tokens, which forces a real DB login when live.
function _buildMockJwt(payload) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 28800 }));
  const sig    = btoa("mock-signature");
  return `${header}.${body}.${sig}`;
}

// Mock login for offline development — remove this block once your backend is live.
function _mockLogin(userId, password, role) {
  const isAdmin = (userId === "ADMIN001" && password === "admin123");
  const isStaff = (userId.startsWith("SEC") && password === "sec123");

  if (isAdmin && role !== "admin") {
    throw new Error("This account is not registered as a Security Officer");
  }
  if (isStaff && role !== "security_staff") {
    throw new Error("This account is not registered as an Administrator");
  }

  if (isAdmin) {
    const token = _buildMockJwt({ userId: "ADMIN001", role: "admin", dbId: 1 });
    return { token, user: { userId: "ADMIN001", name: "Administrator", role: "admin" } };
  }
  if (isStaff) {
    const token = _buildMockJwt({ userId, role: "security_staff", dbId: 2 });
    return { token, user: { userId, name: "Security Officer", role: "security_staff" } };
  }

  throw new Error("Invalid credentials");
}

// Decode the stored JWT payload locally to survive page refreshes without a network call.
function _decodeTokenPayload() {
  const token = getToken();
  if (!token) throw new Error("Unauthorized");

  const parts = token.split(".");
  if (parts.length !== 3) { clearToken(); throw new Error("Invalid token"); }

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      throw new Error("Token expired");
    }
    return { userId: payload.userId, role: payload.role };
  } catch {
    clearToken();
    throw new Error("Invalid token");
  }
}

// =============================================================================
// MOCK DATA (fallback when backend is unreachable)
// =============================================================================

const now   = new Date();
const today = now.toISOString().split("T")[0];

const MOCK_VISITORS = [
  { id: 1, visitorName: "Arjun Menon",  phoneNumber: "9876543210", idProofType: "Aadhar",   idProofNumber: "1234-5678-9012", department: "Computer Science",      visitorStatus: "active",   createdAt: new Date(now - 86400000 * 2).toISOString() },
  { id: 2, visitorName: "Priya Nair",   phoneNumber: "9123456780", idProofType: "PAN",       idProofNumber: "ABCDE1234F",     department: "Administration",        visitorStatus: "active",   createdAt: new Date(now - 86400000).toISOString() },
  { id: 3, visitorName: "Rahul Sharma", phoneNumber: "9988776655", idProofType: "Passport",  idProofNumber: "P1234567",       department: "Mechanical Engineering", visitorStatus: "inactive", createdAt: new Date(now - 86400000 * 5).toISOString() },
];

const MOCK_LOGS = [
  { id: 1, visitorId: 1, visitorName: "Arjun Menon", visitDate: today,                                              entryTime: new Date(now - 3600000 * 2).toISOString(), exitTime: null,                                           purposeOfVisit: "Meeting with HOD",     gateNumber: "1", hostName: "Dr. Krishnan",  passNumber: "PASS-001", status: "inside" },
  { id: 2, visitorId: 2, visitorName: "Priya Nair",  visitDate: today,                                              entryTime: new Date(now - 3600000 * 4).toISOString(), exitTime: new Date(now - 3600000 * 2).toISOString(),      purposeOfVisit: "Document submission",  gateNumber: "2", hostName: "Admin Office",  passNumber: "PASS-002", status: "exited" },
  { id: 3, visitorId: 1, visitorName: "Arjun Menon", visitDate: new Date(now - 86400000).toISOString().split("T")[0], entryTime: new Date(now - 86400000 - 3600000 * 3).toISOString(), exitTime: new Date(now - 86400000 - 3600000).toISOString(), purposeOfVisit: "Lab visit",            gateNumber: "1", hostName: "Prof. Nambiar", passNumber: "PASS-003", status: "exited" },
];

const MOCK_STAFF = [
  { id: 1, staffId: "SEC001", staffName: "Rajan K",  userId: "SEC001", gateAssigned: "Gate 1", createdAt: new Date(now - 86400000 * 30).toISOString() },
  { id: 2, staffId: "SEC002", staffName: "Suresh M", userId: "SEC002", gateAssigned: "Gate 2", createdAt: new Date(now - 86400000 * 20).toISOString() },
];

const MOCK_ACTIVITY = [
  { id: 1, visitorName: "Arjun Menon", purposeOfVisit: "Meeting with HOD",    gateNumber: "1", action: "entered", timestamp: new Date(now - 3600000 * 2).toISOString() },
  { id: 2, visitorName: "Priya Nair",  purposeOfVisit: "Document submission",  gateNumber: "2", action: "exited",  timestamp: new Date(now - 3600000 * 2).toISOString() },
  { id: 3, visitorName: "Priya Nair",  purposeOfVisit: "Document submission",  gateNumber: "2", action: "entered", timestamp: new Date(now - 3600000 * 4).toISOString() },
];

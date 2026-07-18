import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════
const PORT               = Number(process.env.PORT)              || 8080;
const SESSION_SECRET     = process.env.SESSION_SECRET            || "mdt-secret-key";
const GAME_API_KEY       = process.env.GAME_API_KEY              || "CHANGE_THIS_API_KEY";
const SUPABASE_URL       = process.env.SUPABASE_URL              || "";
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_KEY      || "";
const ROBLOX_CLIENT_ID   = process.env.ROBLOX_CLIENT_ID         || "";
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET   || "";
const ROBLOX_GROUP_ID    = process.env.ROBLOX_GROUP_ID          || "0";
const ROBLOX_REDIRECT    = process.env.ROBLOX_REDIRECT_URI      || "http://localhost:8080/api/auth/callback";
const ALLOWED_RANKS      = (process.env.ALLOWED_RANKS || "250,251,252,253,254,255")
                            .split(",").map(r => parseInt(r.trim(), 10));

// ── Supabase client (server-side, service key)
function db() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ══════════════════════════════════════════════════════════════
//  ROBLOX HELPERS
// ══════════════════════════════════════════════════════════════
async function robloxUserInfo(token) {
  const r = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Roblox userinfo failed: " + r.status);
  return r.json();
}

async function groupRank(userId) {
  const r = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
  if (!r.ok) return { rank: "Guest", rankId: 0 };
  const data = await r.json();
  const g = data.data?.find(g => String(g.group.id) === ROBLOX_GROUP_ID);
  return g ? { rank: g.role.name, rankId: g.role.rank } : { rank: "Guest", rankId: 0 };
}

async function avatarUrl(userId) {
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);
    if (!r.ok) return "";
    const data = await r.json();
    return data.data?.[0]?.imageUrl || "";
  } catch { return ""; }
}

// ══════════════════════════════════════════════════════════════
//  SESSION COOKIE HELPERS
// ══════════════════════════════════════════════════════════════
function readSession(req) {
  const c = req.cookies?.mdt_session;
  if (!c) return null;
  try { return JSON.parse(Buffer.from(c, "base64").toString("utf8")); }
  catch { return null; }
}

function writeSession(res, session) {
  res.cookie("mdt_session", Buffer.from(JSON.stringify(session)).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ══════════════════════════════════════════════════════════════
//  EXPRESS SETUP
// ══════════════════════════════════════════════════════════════
const app = express();
app.set("trust proxy", true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

// ══════════════════════════════════════════════════════════════
//  ROUTES — CONFIG
// ══════════════════════════════════════════════════════════════
app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl:     process.env.VITE_SUPABASE_URL      || SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
  });
});

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

// ══════════════════════════════════════════════════════════════
//  ROUTES — AUTH
// ══════════════════════════════════════════════════════════════

// IP auto-login (owner only)
app.get("/api/auth/ip-login", async (req, res) => {
  const ownerIp = process.env.OWNER_IP;
  const ownerId = process.env.OWNER_ROBLOX_ID;
  if (!ownerIp || !ownerId) { res.status(404).json({ error: "IP login not configured" }); return; }

  const fwd = req.headers["x-forwarded-for"];
  const ip  = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0].trim() || req.socket.remoteAddress || "";
  if (ip !== ownerIp) { res.status(403).json({ error: "IP not authorized" }); return; }

  // Already logged in?
  const existing = readSession(req);
  if (existing?.robloxUserId === ownerId) { res.json(existing); return; }

  try {
    const [rank, avatar, userRes] = await Promise.all([
      groupRank(ownerId),
      avatarUrl(ownerId),
      fetch(`https://users.roblox.com/v1/users/${ownerId}`),
    ]);
    const userData = await userRes.json();
    const userName = process.env.OWNER_USERNAME || userData.displayName || userData.name || "Owner";
    const session = { robloxUserId: ownerId, userName, rank: rank.rank || "Owner", rankId: rank.rankId, avatarUrl: avatar, isPolice: true, jobId: null, team: null };

    const supabase = db();
    if (supabase) await supabase.from("mdt_users").upsert({ roblox_user_id: ownerId, user_name: userName, rank: session.rank, rank_id: rank.rankId, is_police: true, avatar_url: avatar, updated_at: new Date().toISOString() });

    writeSession(res, session);
    res.json(session);
  } catch (e) { res.status(500).json({ error: "Failed to fetch owner info", reason: String(e) }); }
});

// Roblox OAuth URL
app.get("/api/auth/roblox", (_req, res) => {
  const params = new URLSearchParams({ client_id: ROBLOX_CLIENT_ID, redirect_uri: ROBLOX_REDIRECT, response_type: "code", scope: "openid profile", state: Math.random().toString(36).slice(2) });
  res.json({ url: `https://apis.roblox.com/oauth/v1/authorize?${params}` });
});

// OAuth callback
app.get("/api/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }
  try {
    const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: ROBLOX_CLIENT_ID, client_secret: ROBLOX_CLIENT_SECRET, redirect_uri: ROBLOX_REDIRECT }),
    });
    if (!tokenRes.ok) { res.status(401).json({ error: "Token exchange failed", reason: await tokenRes.text() }); return; }

    const { access_token } = await tokenRes.json();
    const info = await robloxUserInfo(access_token);
    const userId = info.sub;
    const userName = info.preferred_username || info.name;
    const { rank, rankId } = await groupRank(userId);
    const isPolice = ALLOWED_RANKS.includes(rankId);
    const avatar = await avatarUrl(userId);
    const session = { robloxUserId: userId, userName, rank, rankId, avatarUrl: avatar, isPolice, jobId: null, team: null };

    const supabase = db();
    if (supabase) await supabase.from("mdt_users").upsert({ roblox_user_id: userId, user_name: userName, rank, rank_id: rankId, is_police: isPolice, avatar_url: avatar, updated_at: new Date().toISOString() });

    writeSession(res, session);
    res.redirect("/");
  } catch (e) { res.status(500).json({ error: "Internal server error", reason: String(e) }); }
});

// Current session
app.get("/api/auth/me", async (req, res) => {
  const session = readSession(req);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const supabase = db();
    if (supabase && session.robloxUserId) {
      const { data } = await supabase.from("mdt_sessions").select("job_id, team").eq("roblox_user_id", session.robloxUserId).maybeSingle();
      if (data) { session.jobId = data.job_id; session.team = data.team; }
    }
    res.json(session);
  } catch { res.status(401).json({ error: "Invalid session" }); }
});

// Logout
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("mdt_session");
  res.json({ success: true });
});

// Group rank lookup
app.get("/api/group/:userId/rank", async (req, res) => {
  try {
    const { rank, rankId } = await groupRank(req.params.userId);
    res.json({ rank, rankId, isPolice: ALLOWED_RANKS.includes(rankId) });
  } catch (e) { res.status(404).json({ error: "User not found", reason: String(e) }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — DISPATCHES
// ══════════════════════════════════════════════════════════════
app.post("/api/dispatches", async (req, res) => {
  if (req.headers["x-api-key"] !== GAME_API_KEY) { res.status(401).json({ error: "Invalid API key" }); return; }
  const { server_id, caller, type, location, description = "", priority = "HIGH" } = req.body;
  if (!server_id || !caller || !type || !location) { res.status(400).json({ error: "Missing required fields" }); return; }

  const supabase = db();
  if (!supabase) { res.json({ success: true, message: "Demo mode", dispatch: { id: "demo-" + Date.now(), server_id, caller, type, location, description, priority, status: "pending" } }); return; }

  const { data, error } = await supabase.from("mdt_dispatches").insert({ server_id, caller, type, location, description, priority, status: "pending", accepted_by: null, accepted_by_name: null }).select().single();
  if (error) { res.status(500).json({ error: "Failed to create dispatch", reason: error.message }); return; }
  res.json({ success: true, dispatch: data });
});

app.patch("/api/dispatches/:id/accept", async (req, res) => {
  const session = readSession(req);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
  const supabase = db();
  if (!supabase) { res.json({ success: true, message: "Demo mode" }); return; }

  const { data: existing } = await supabase.from("mdt_dispatches").select("status, accepted_by").eq("id", req.params.id).single();
  if (!existing) { res.status(404).json({ error: "Dispatch not found" }); return; }
  if (existing.status === "accepted") { res.status(409).json({ error: "Already accepted", accepted_by: existing.accepted_by, reason: "تم قبول البلاغ من قبل ضابط آخر" }); return; }

  const { data, error } = await supabase.from("mdt_dispatches").update({ status: "accepted", accepted_by: session.robloxUserId, accepted_by_name: session.userName }).eq("id", req.params.id).eq("status", "pending").select().single();
  if (error || !data) { res.status(409).json({ error: "Accept failed", reason: error?.message }); return; }
  res.json({ success: true, dispatch: data });
});

app.patch("/api/dispatches/:id/reject", async (req, res) => {
  const session = readSession(req);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
  const supabase = db();
  if (!supabase) { res.json({ success: true, message: "Demo mode" }); return; }

  const { error } = await supabase.from("mdt_dispatches").delete().eq("id", req.params.id);
  if (error) { res.status(500).json({ error: "Failed to reject", reason: error.message }); return; }
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — SESSIONS (Roblox game sync)
// ══════════════════════════════════════════════════════════════
app.put("/api/sessions/:userId", async (req, res) => {
  if (req.headers["x-api-key"] !== GAME_API_KEY) { res.status(401).json({ error: "Invalid API key" }); return; }
  const { jobId, team } = req.body;
  if (!jobId || !team) { res.status(400).json({ error: "Missing jobId or team" }); return; }

  const supabase = db();
  if (!supabase) { res.json({ success: true, message: "Demo mode" }); return; }

  const { error } = await supabase.from("mdt_sessions").upsert({ roblox_user_id: req.params.userId, job_id: jobId, team, updated_at: new Date().toISOString() });
  if (error) { res.status(500).json({ error: "Failed to update session", reason: error.message }); return; }
  res.json({ success: true, message: "Session updated" });
});

app.get("/api/sessions/:userId", async (req, res) => {
  const supabase = db();
  if (!supabase) { res.status(404).json({ error: "Supabase not configured" }); return; }

  const { data, error } = await supabase.from("mdt_sessions").select("*").eq("roblox_user_id", req.params.userId).maybeSingle();
  if (error || !data) { res.status(404).json({ error: "Session not found", reason: error?.message || null }); return; }
  res.json({ robloxUserId: data.roblox_user_id, jobId: data.job_id, team: data.team, updatedAt: data.updated_at });
});

// ══════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════
app.listen(PORT, () => console.log(`[MDT] Server running on port ${PORT}`));

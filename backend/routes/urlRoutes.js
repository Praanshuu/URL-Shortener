const express = require("express");
const { verifyToken } = require("@clerk/backend");
const { pool } = require("../database");
const { handleGenerateNewShortURL, handleGetAnalytics } = require("../controllers/url");

const router = express.Router();

// ── Clerk auth middleware ─────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized: no token" });

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    req.auth = { userId: payload.sub };
    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}


// ── POST /url — shorten a URL (auth required) ──────────────────────────────
router.post("/", requireAuth, handleGenerateNewShortURL);

// ── GET /url/all — fetch current user's URLs (auth required) ──────────────
router.get("/all", requireAuth, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const result = await pool.query(
      `SELECT u.*, COUNT(v.id)::int AS click_count
       FROM urls u
       LEFT JOIN visits v ON v.url_id = u.id
       WHERE u.user_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("❌ Fetch all error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── GET /url/analytics/:shortId (auth required) ───────────────────────────
router.get("/analytics/:shortId", requireAuth, handleGetAnalytics);

// ── GET /url/:shortId — redirect (public, no auth) ────────────────────────
router.get("/:shortId", async (req, res) => {
  const { shortId } = req.params;
  try {
    const urlRow = await pool.query(
      `SELECT id, redirect_url FROM urls WHERE short_id = $1`,
      [shortId]
    );
    if (!urlRow.rows.length) return res.status(404).json({ error: "URL not found" });

    const { id, redirect_url } = urlRow.rows[0];

    // Record visit (fire-and-forget)
    pool.query(`INSERT INTO visits (url_id) VALUES ($1)`, [id]).catch(console.error);

    return res.redirect(redirect_url);
  } catch (error) {
    console.error("❌ Redirect error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

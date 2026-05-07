const { nanoid } = require("nanoid");
const { pool } = require("../database");

const BASE_URL = process.env.BASE_URL || "http://localhost:8001";

async function handleGenerateNewShortURL(req, res) {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    try { new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }

    const shortId = nanoid(8);
    const shortUrl = `${BASE_URL}/url/${shortId}`;
    const userId = req.auth.userId;

    const result = await pool.query(
      `INSERT INTO urls (short_id, redirect_url, short_url, user_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [shortId, url, shortUrl, userId]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error creating short URL:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleGetAnalytics(req, res) {
  try {
    const { shortId } = req.params;
    const userId = req.auth.userId;
    const urlRow = await pool.query(
      `SELECT id FROM urls WHERE short_id = $1 AND user_id = $2`,
      [shortId, userId]
    );
    if (!urlRow.rows.length) return res.status(404).json({ error: "Not found" });

    const visits = await pool.query(
      `SELECT COUNT(*) AS total_clicks FROM visits WHERE url_id = $1`,
      [urlRow.rows[0].id]
    );
    return res.json({ totalClicks: parseInt(visits.rows[0].total_clicks, 10) });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { handleGenerateNewShortURL, handleGetAnalytics };

const express = require("express");
const URL = require("../models/Url");
const { handleGenerateNewShortURL, handleGetAnalytics } = require("../controllers/url");


const router = express.Router();

// 🔹 POST: Create a short URL
router.post("/", handleGenerateNewShortURL);

// 🔹 GET: Fetch analytics for a short URL
router.get("/analytics/:shortId", handleGetAnalytics);

// 🔹 ✅ NEW: Fetch all shortened URLs (For frontend table)
router.get("/all", async (req, res) => {
    try {
        console.log("🔍 Fetching all short URLs...");

        const urls = await URL.find({});

        if (!urls || urls.length === 0) {
            console.error("❌ No short URLs found.");
            return res.status(404).json({ error: "No short URLs found" });
        }

        console.log("✅ Found URLs:", urls.length);
        res.json(urls);
    } catch (error) {
        console.error("❌ Error fetching links:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

// 🔹 GET: Redirect to original URL
router.get("/:shortId", async (req, res) => {
    const { shortId } = req.params;

    try {
        const entry = await URL.findOne({ shortId });

        if (!entry) {
            return res.status(404).json({ error: "Short URL not found" });
        }

        entry.visitHistory.push({ timestamp: Date.now() });
        await entry.save();

        res.redirect(entry.redirectURL);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;


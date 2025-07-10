const { nanoid } = require("nanoid");
const URL = require("../models/Url");

const BASE_URL = "http://localhost:8001";  // 👈 Make sure this matches your backend

async function handleGenerateNewShortURL(req, res) {
    try {
        console.log("Request received:", req.body);

        const { Url, url } = req.body;
        const redirectURL = Url || url;

        if (!redirectURL) {
            return res.status(400).json({ error: "url is required" });
        }

        const shortId = nanoid(8);
        const shortUrl = `${BASE_URL}/${shortId}`;  // 👈 Construct the full short URL

        const newUrl = await URL.create({
            shortId,
            shortUrl,  // 👈 Store full short URL
            redirectURL,
            visitHistory: [],
        });

        console.log("New URL saved:", newUrl);

        return res.json({ id: shortId, shortUrl });  // 👈 Return full URL to frontend
    } catch (error) {
        console.error("Error creating short URL:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}

async function handleGetAnalytics(req, res) {
    try {
        const { shortId } = req.params;
        const entry = await URL.findOne({ shortId });

        if (!entry) {
            return res.status(404).json({ error: "Short URL not found" });
        }

        res.json({ totalClicks: entry.visitHistory.length });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
}

module.exports = {
    handleGenerateNewShortURL,
    handleGetAnalytics, // ✅ Add this export
};

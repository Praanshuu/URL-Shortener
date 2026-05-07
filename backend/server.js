require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { initDB } = require("./database");
const urlRoute = require("./routes/urlRoutes");

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow all Vercel deployments, localhost, and direct API calls
    const allowed = !origin
      || origin.includes("vercel.app")
      || origin.includes("localhost");
    callback(null, allowed);
  },
  credentials: true,
}));
app.use(express.json());

// ✅ URL routes
app.use("/url", urlRoute);

// ✅ Initialize DB tables, then start server
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Failed to initialize DB:", err);
    process.exit(1);
  });

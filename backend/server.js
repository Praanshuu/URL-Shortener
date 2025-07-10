require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectToMongoDB } = require("./database");
const urlRoute = require("./routes/urlRoutes");

const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());

// ✅ Ensure /url is correctly mounted
app.use("/url", urlRoute);

connectToMongoDB(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

app.listen(PORT, () => console.log(`🚀 Server Started at PORT:${PORT}`));

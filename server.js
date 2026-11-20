const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const APP_ORIGIN = process.env.APP_ORIGIN || "*";

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors({ origin: APP_ORIGIN === "*" ? true : APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

const stateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "application" },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const State = mongoose.models.State || mongoose.model("State", stateSchema);

const defaultState = () => ({
  version: 4,
  theme: "dark",
  products: [],
  categories: [],
  orders: [],
  expenses: [],
  stockMovements: [],
  employees: [],
  settings: { name: "DZ Legends Pizza", address: "", phone: "", logo: "", loginGif: "", favicon32: "", favicon64: "" }
});

function dbReady() {
  return mongoose.connection.readyState === 1;
}

app.get("/api/health", async (_req, res) => {
  try {
    if (!dbReady()) {
      return res.json({ ok: true, database: "disconnected", service: "DZ Legends Pizza" });
    }
    await State.findOne({ key: "application" }).lean().maxTimeMS(5000);
    res.json({ ok: true, database: "connected", service: "DZ Legends Pizza" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    if (!dbReady()) {
      return res.json({ ok: true, state: defaultState() });
    }
    const doc = await State.findOne({ key: "application" }).lean().maxTimeMS(5000);
    res.json({ ok: true, state: doc ? doc.data : defaultState() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, error: "Invalid state payload" });
    }
    if (!dbReady()) {
      return res.json({ ok: true, updatedAt: new Date(), offline: true });
    }
    const updated = await State.findOneAndUpdate(
      { key: "application" },
      { key: "application", data: req.body, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).maxTimeMS(5000);
    res.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/uploads/:id", async (_req, res) => {
  res.status(404).json({ ok: false, error: "Upload not found" });
});

app.use(express.static(path.join(__dirname, "site"), { extensions: ["html"], index: "index.html" }));
app.use(express.static(__dirname));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "site", "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

async function connectDatabase() {
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI is not set. Running without persistent database.");
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

connectDatabase().finally(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DZ Legends Pizza server running on port ${PORT}`);
  });
});

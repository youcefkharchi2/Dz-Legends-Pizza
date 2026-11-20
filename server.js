const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "youcefkharchi2";
const GITHUB_REPO = process.env.GITHUB_REPO || "Dz-Legends-Pizza";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const APP_ORIGIN = process.env.APP_ORIGIN || "*";

// In-memory cache to reduce GitHub API calls
let stateCache = null;
let stateCacheTime = 0;
const CACHE_TTL = 60000;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors({ origin: APP_ORIGIN === "*" ? true : APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Prevent stale frontend caches on mobile browsers
app.use((req, res, next) => {
  if (req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".html") || req.path === "/") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

const DATA_FILES = {
  products: "data/products.json",
  categories: "data/categories.json",
  orders: "data/orders.json",
  expenses: "data/expenses.json",
  stock: "data/stock.json",
  stockMovements: "data/stock-movements.json",
  employees: "data/employees.json",
  settings: "data/settings.json"
};

const githubHeaders = () => ({
  "Authorization": "token " + GITHUB_TOKEN,
  "Accept": "application/vnd.github.v3+json",
  "User-Agent": "DZ-Legends-Pizza-Server"
});

async function githubGet(filePath) {
  if (!GITHUB_TOKEN) {
    const fs = require("fs");
    const localPath = path.join(__dirname, filePath);
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, "utf8"));
    }
    return null;
  }
  const url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + filePath + "?ref=" + GITHUB_BRANCH;
  let response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 429 || response.status === 403) {
    const retryAfter = response.headers.get("retry-after") || "60";
    console.warn("GitHub rate limited. Retry after " + retryAfter + "s");
    await new Promise(r => setTimeout(r, Math.min(parseInt(retryAfter) * 1000, 5000)));
    response = await fetch(url, { headers: githubHeaders() });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("GitHub GET error:", response.status, errorBody);
    throw new Error("GitHub GET failed: " + response.status + " - " + errorBody);
  }
  const payload = await response.json();
  const content = Buffer.from(payload.content, "base64").toString("utf8");
  return JSON.parse(content);
}

async function githubPut(filePath, data, message) {
  if (!GITHUB_TOKEN) {
    const fs = require("fs");
    const localPath = path.join(__dirname, filePath);
    fs.writeFileSync(localPath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true, local: true };
  }
  const url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + filePath;
  let sha = null;
  try {
    const existing = await fetch(url + "?ref=" + GITHUB_BRANCH, { headers: githubHeaders() });
    if (existing.ok) {
      const payload = await existing.json();
      sha = payload.sha;
    }
  } catch (e) {}
  const body = {
    message: message || "Update " + filePath,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;
  const response = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error("GitHub PUT error:", response.status, errorText);
    throw new Error("GitHub PUT failed: " + response.status + " - " + errorText);
  }
  return response.json();
}

app.get("/api/health", async (_req, res) => {
  try {
    const hasToken = Boolean(GITHUB_TOKEN);
    res.json({ ok: true, service: "DZ Legends Pizza", github: hasToken ? "connected" : "local-only", owner: GITHUB_OWNER, repo: GITHUB_REPO });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    const now = Date.now();
    if (stateCache && (now - stateCacheTime) < CACHE_TTL) {
      return res.json({ ok: true, state: stateCache, cached: true });
    }
    const state = {};
    for (const [key, filePath] of Object.entries(DATA_FILES)) {
      const data = await githubGet(filePath);
      state[key] = data !== null ? data : (key === "categories" ? [] : key === "settings" ? { name: "DZ Legends Pizza", address: "", phone: "", logo: "", loginGif: "", favicon32: "", favicon64: "", theme: "dark" } : []);
    }
    if (!state.categories || state.categories.length === 0) {
      state.categories = [{ id: "cat-pizzas", name: "Pizzas", image: "" }, { id: "cat-boissons", name: "Boissons", image: "" }];
    }
    stateCache = state;
    stateCacheTime = now;
    res.json({ ok: true, state });
  } catch (error) {
    if (stateCache) {
      return res.json({ ok: true, state: stateCache, cached: true, stale: true });
    }
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, error: "Invalid state payload" });
    }
    const body = req.body;
    const results = {};
    for (const [key, filePath] of Object.entries(DATA_FILES)) {
      if (body[key] !== undefined) {
        const message = "Update " + key + " via DZ Legends Pizza";
        const result = await githubPut(filePath, body[key], message);
        results[key] = result.ok !== false;
      }
    }
    stateCache = null;
    stateCacheTime = 0;
    res.json({ ok: true, updatedAt: new Date(), results });
  } catch (error) {
    console.error("PUT error:", error.message);
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

app.listen(PORT, "0.0.0.0", () => {
  console.log("DZ Legends Pizza server running on port " + PORT);
  console.log("GitHub: " + GITHUB_OWNER + "/" + GITHUB_REPO + " (branch: " + GITHUB_BRANCH + ")");
  console.log("GitHub token: " + (GITHUB_TOKEN ? "configured" : "NOT configured (local-only mode)"));
});

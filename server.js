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
const REQUEST_TIMEOUT_MS = 20000;
const CACHE_TTL = 60000;

let stateCache = null;
let cacheTime = 0;
let lastGithubSuccess = null;
let lastGithubError = null;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cors({ origin: APP_ORIGIN === "*" ? true : APP_ORIGIN, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use((req, res, next) => {
  if (req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".html") || req.path === "/") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

const DATA_FILES = {
  products: "data/products.json",
  categories: "data/categories.json",
  orders: "data/orders.json",
  expenses: "data/expenses.json",
  employees: "data/employees.json",
  settings: "data/settings.json"
};

function githubHeaders() {
  return {
    Authorization: "token " + GITHUB_TOKEN,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "DZ-Legends-Pizza-Server",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function requireToken() {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured. Configure it in Render Environment Variables.");
  }
}

function githubMessage(status, body) {
  try {
    const parsed = JSON.parse(body);
    return parsed.message || body;
  } catch {
    return body || "";
  }
}

function assertGithubResponse(response, body, context) {
  if (response.ok) return;
  const message = githubMessage(response.status, body);
  if (response.status === 401 || response.status === 403) {
    if (/rate limit/i.test(message)) {
      throw new Error("GitHub API rate limit exceeded. " + message);
    }
    throw new Error("GitHub authentication failed for " + context + ". " + message);
  }
  if (response.status === 404) {
    throw new Error("Central data file not found: " + context);
  }
  throw new Error("GitHub " + context + " failed (" + response.status + "). " + message);
}

async function githubFetch(url, options = {}, context = "GitHub request") {
  requireToken();
  const response = await fetch(url, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const body = await response.text();
  assertGithubResponse(response, body, context);
  return { response, body };
}

async function githubGetFile(filePath) {
  const url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + filePath + "?ref=" + encodeURIComponent(GITHUB_BRANCH);
  const { body } = await githubFetch(url, {}, filePath);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Invalid GitHub response for " + filePath);
  }
  if (!payload || typeof payload.content !== "string") {
    throw new Error("GitHub response has no content for " + filePath);
  }
  const content = Buffer.from(payload.content.replace(/\s/g, ""), "base64").toString("utf8");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON in central file " + filePath);
  }
}

async function githubPutFile(filePath, data, message, attempt = 0) {
  const url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + filePath;
  let sha = null;
  try {
    const existing = await githubFetch(url + "?ref=" + encodeURIComponent(GITHUB_BRANCH), {}, filePath);
    const payload = JSON.parse(existing.body || "null");
    if (payload && payload.sha) sha = payload.sha;
  } catch (error) {
    if (!/not found/i.test(error.message)) throw error;
  }

  const body = {
    message: message || "Update " + filePath + " via DZ Legends Pizza",
    content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64"),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const text = await response.text();
    if (response.status === 409 && attempt === 0) {
      return githubPutFile(filePath, data, message, 1);
    }
    assertGithubResponse(response, text, filePath + " write");
    return JSON.parse(text || "{}");
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("GitHub write timed out for " + filePath);
    }
    throw error;
  }
}

async function readCentralState() {
  requireToken();
  const entries = Object.entries(DATA_FILES);
  const results = await Promise.all(entries.map(async ([key, filePath]) => {
    const data = await githubGetFile(filePath);
    if (data === null || data === undefined) {
      throw new Error("Central data file is empty: " + filePath);
    }
    const isCollection = key !== "settings";
    if (isCollection && !Array.isArray(data)) {
      throw new Error("Central data file must contain an array: " + filePath);
    }
    if (!isCollection && (typeof data !== "object" || Array.isArray(data))) {
      throw new Error("Central data file must contain an object: " + filePath);
    }
    return [key, data];
  }));
  const state = {};
  for (const [key, value] of results) state[key] = value;
  stateCache = state;
  cacheTime = Date.now();
  lastGithubSuccess = new Date().toISOString();
  lastGithubError = null;
  return state;
}

function validateSection(key, value) {
  if (key === "settings") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("settings must be an object");
    }
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(key + " must be an array");
  }
}

app.get("/api/health", (_req, res) => {
  const configured = Boolean(GITHUB_TOKEN);
  const healthy = configured && !lastGithubError;
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    service: "DZ Legends Pizza",
    github: configured ? (lastGithubError ? "error" : "connected") : "not-configured",
    tokenConfigured: configured,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    lastSyncAt: lastGithubSuccess,
    lastError: lastGithubError
  });
});

app.get("/api/state", async (_req, res) => {
  const now = Date.now();
  if (stateCache && (now - cacheTime) < CACHE_TTL && !lastGithubError) {
    return res.json({ ok: true, state: stateCache, cached: true, stale: false, syncedAt: lastGithubSuccess });
  }
  try {
    const state = await readCentralState();
    return res.json({ ok: true, state, cached: false, stale: false, syncedAt: lastGithubSuccess });
  } catch (error) {
    lastGithubError = error.message;
    console.error("GET /api/state failed:", error.message);
    if (stateCache) {
      return res.json({
        ok: true,
        state: stateCache,
        cached: true,
        stale: true,
        syncedAt: lastGithubSuccess,
        warning: error.message
      });
    }
    return res.status(503).json({ ok: false, error: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    requireToken();
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, error: "Invalid state payload" });
    }

    const sections = req.body.sections && typeof req.body.sections === "object" && !Array.isArray(req.body.sections)
      ? req.body.sections
      : req.body;
    const keys = Object.keys(sections).filter(key => Object.prototype.hasOwnProperty.call(DATA_FILES, key));
    if (!keys.length) {
      return res.status(400).json({ ok: false, error: "No known data section was provided" });
    }
    for (const key of keys) validateSection(key, sections[key]);

    const results = {};
    for (const key of keys) {
      const filePath = DATA_FILES[key];
      results[key] = await githubPutFile(filePath, sections[key], "Update " + key + " via DZ Legends Pizza");
      console.log("Updated central file:", filePath);
    }

    if (stateCache) {
      for (const key of keys) stateCache[key] = sections[key];
      cacheTime = Date.now();
    }
    lastGithubError = null;
    return res.json({ ok: true, updated: keys, updatedAt: new Date().toISOString(), results });
  } catch (error) {
    console.error("PUT /api/state failed:", error.message);
    return res.status(502).json({ ok: false, error: error.message });
  }
});

app.get("/api/uploads/:id", (_req, res) => {
  res.status(404).json({ ok: false, error: "Upload not found" });
});

app.use(express.static(path.join(__dirname, "site"), { extensions: ["html"], index: "index.html" }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "site", "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("DZ Legends Pizza server running on port " + PORT);
  console.log("Central storage: " + GITHUB_OWNER + "/" + GITHUB_REPO + " (" + GITHUB_BRANCH + ")");
  console.log("GitHub token: " + (GITHUB_TOKEN ? "configured" : "MISSING - set GITHUB_TOKEN in Render Environment Variables"));
});

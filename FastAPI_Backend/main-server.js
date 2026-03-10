require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

// Import auth and progress routes
const authRoutes = require("./routes/auth");
const progressRoutes = require("./routes/progress");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const primaryMongoUri = process.env.MONGODB_URI;
const fallbackMongoUri = process.env.MONGODB_LOCAL_URI || process.env.LOCAL_MONGODB_URI;
const resolvedMongoUri = primaryMongoUri || fallbackMongoUri;
const mongoUriSource = primaryMongoUri ? "MONGODB_URI" : fallbackMongoUri ? "MONGODB_LOCAL_URI" : null;

let mongooseConnected = false;

function formatMongoError(err) {
  if (!err) {
    return "Unknown MongoDB error";
  }

  if (err.code === "ENOTFOUND") {
    return [
      `DNS lookup failed for MongoDB host: ${err.hostname || "unknown host"}.`,
      "Update FastAPI_Backend/.env with a valid Atlas connection string in MONGODB_URI,",
      "or set MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/feelwise_db after installing a local MongoDB server."
    ].join(" ");
  }

  return err.message || String(err);
}

async function connectMongoose() {
  if (!resolvedMongoUri) {
    console.error(
      "❌ MongoDB is not configured. Set MONGODB_URI for Atlas or MONGODB_LOCAL_URI for a local database."
    );
    return false;
  }

  try {
    await mongoose.connect(resolvedMongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    mongooseConnected = true;
    console.log(`✅ MongoDB (Mongoose) connected using ${mongoUriSource}`);
    return true;
  } catch (err) {
    mongooseConnected = false;
    console.error("❌ MongoDB (Mongoose) connection error:", formatMongoError(err));
    return false;
  }
}

// ---------------------------
// MongoDB Connection (Mongoose for auth, MongoClient for journals)
// ---------------------------
connectMongoose();

// MongoDB Atlas Setup for journals (using same URI as Mongoose)
const MONGO_URI = resolvedMongoUri;

let mongoClient;
async function checkMongoConnection() {
  try {
    if (!MONGO_URI) {
      return {
        status: "not_configured",
        details: "Set MONGODB_URI for Atlas or MONGODB_LOCAL_URI for a local database.",
      };
    }

    if (!mongoClient) {
      mongoClient = new MongoClient(MONGO_URI, { 
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
      });
      await mongoClient.connect();
    }
    const db = mongoClient.db("feelwise_db");
    const count = await db.collection("journals").countDocuments();
    return { status: "ok", db: "feelwise_db", journal_count: count };
  } catch (err) {
    return { status: "error", details: formatMongoError(err) };
  }
}

// ---------------------------
// Generate a simple request ID for logging
// ---------------------------
app.use((req, res, next) => {
  req._rid = Math.random().toString(36).substring(2, 10);
  next();
});

// ---------------------------
// Enhanced CORS Middleware
// ---------------------------
const configuredOrigins = [process.env.FRONTEND_URL, process.env.ALLOWED_ORIGINS]
  .filter(Boolean)
  .join(",")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://feelwise-emotion-detection.feelwise.workers.dev",
  ...configuredOrigins,
]);

function isAllowedDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    const isDevPort = ["3000", "5500", "5501"].includes(parsed.port);
    const isPrivateIpv4 = /^(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(
      parsed.hostname
    );

    return isHttp && isDevPort && isPrivateIpv4;
  } catch {
    return false;
  }
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.has(origin) && !isAllowedDevOrigin(origin)) {
      const msg = `CORS policy does not allow access from: ${origin}`;
      console.error(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS", "PUT", "PATCH"],
  allowedHeaders: ["Content-Type", "X-Request-Id", "Authorization"],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ---------------------------
// Middleware (200MB limit for images/audio)
// ---------------------------
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// ---------------------------
// Serve static files (for development and uploads)
// ---------------------------
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Base URLs for FastAPI services
// ---------------------------
function normalizeServiceUrl(url) {
  return url ? url.replace(/\/+$/, "") : "";
}

const defaultServiceUrls = isProduction
  ? {
      text: "https://text-analysis-api-jjd2.onrender.com",
      face: "",
      speech: "",
      journal: "https://journal-api-tz31.onrender.com",
    }
  : {
      text: "http://127.0.0.1:8001",
      face: "http://127.0.0.1:8002",
      speech: "http://127.0.0.1:8000",
      journal: "http://127.0.0.1:8004",
    };

const SERVICES = {
  text: normalizeServiceUrl(process.env.TEXT_SERVICE_URL || defaultServiceUrls.text),
  face: normalizeServiceUrl(process.env.FACE_SERVICE_URL || defaultServiceUrls.face),
  speech: normalizeServiceUrl(process.env.SPEECH_SERVICE_URL || defaultServiceUrls.speech),
  journal: normalizeServiceUrl(process.env.JOURNAL_SERVICE_URL || defaultServiceUrls.journal),
};

function ensureServiceAvailable(serviceName, res) {
  if (SERVICES[serviceName]) {
    return true;
  }

  return res.status(503).json({
    error: `${serviceName} service is not configured`,
    details: `Set ${serviceName.toUpperCase()}_SERVICE_URL to enable this feature in production.`,
  });
}

// ---------------------------
// Utility function for proxy requests
// ---------------------------
async function proxyRequest(serviceUrl, req, res, options = {}) {
  const rid = req._rid;
  try {
    console.log(`➡️  [${rid}] Proxying: ${req.method} ${serviceUrl}`);
    
    const fetchOptions = {
      method: req.method,
      headers: { 
        "Content-Type": "application/json",
        "X-Request-Id": rid 
      },
      ...options
    };
    
    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(serviceUrl, fetchOptions);
    const text = await response.text();
    
    console.log(`⬅️  [${rid}] Response: ${response.status}`);
    
    return res.status(response.ok ? 200 : response.status)
              .type("application/json")
              .send(text);
  } catch (err) {
    console.error(`🟥 [${rid}] Proxy error: ${err.message}`);
    return res.status(500).json({ 
      error: "Proxy error", 
      details: err.message 
    });
  }
}

// ---------------------------
// Authentication & Progress Routes
// ---------------------------
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);

// ---------------------------
// Proxy route for Text Analysis
// ---------------------------
app.post("/analyze", async (req, res) => {
  if (ensureServiceAvailable("text", res) !== true) {
    return;
  }
  await proxyRequest(`${SERVICES.text}/analyze`, req, res);
});

// ---------------------------
// Proxy route for Face Analysis
// ---------------------------
app.post("/analyze-face", async (req, res) => {
  if (ensureServiceAvailable("face", res) !== true) {
    return;
  }
  await proxyRequest(`${SERVICES.face}/analyze_face`, req, res);
});

// ---------------------------
// Proxy route for Speech Analysis
// ---------------------------
app.post("/analyze-speech", async (req, res) => {
  if (ensureServiceAvailable("speech", res) !== true) {
    return;
  }
  const { transcript, audio } = req.body || {};
  if (!audio || typeof audio !== "string" || audio.length < 1000) {
    return res.status(400).json({ error: "Audio is required (base64 > 1KB)" });
  }
  
  await proxyRequest(`${SERVICES.speech}/analyze_speech`, req, res);
});

// ---------------------------
// Journal Module Routes
// ---------------------------

// Get random prompt
app.get("/journal/prompts", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  await proxyRequest(`${SERVICES.journal}/journal/prompts`, req, res);
});

// Analyze journal text
app.post("/journal/analyze", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  await proxyRequest(`${SERVICES.journal}/journal/analyze`, req, res);
});

// Create/Save journal entry
app.post("/journal/entry", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  const user_id = req.query.user_id || "default_user";
  const url = `${SERVICES.journal}/journal/entry?user_id=${encodeURIComponent(user_id)}`;
  await proxyRequest(url, req, res);
});

// Get journal entries
app.get("/journal/entries", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  const queryParams = new URLSearchParams({
    range: req.query.range || "30d",
    user_id: req.query.user_id || "default_user"
  });
  
  const url = `${SERVICES.journal}/journal/entries?${queryParams}`;
  await proxyRequest(url, req, res);
});

// Get journal insights (mood trends, keywords, etc.)
app.get("/journal/insights", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  const queryParams = new URLSearchParams({
    range: req.query.range || "30d", 
    user_id: req.query.user_id || "default_user"
  });
  
  const url = `${SERVICES.journal}/journal/insights?${queryParams}`;
  await proxyRequest(url, req, res);
});

// Delete journal entry
app.delete("/journal/entry/:id", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  const url = `${SERVICES.journal}/journal/entry/${encodeURIComponent(req.params.id)}`;
  await proxyRequest(url, req, res);
});

// ---------------------------
// Legacy journal routes (for backward compatibility)
// ---------------------------
app.post("/journal", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  // Redirect to new entry endpoint
  await proxyRequest(`${SERVICES.journal}/journal/entry`, req, res);
});

app.get("/journal", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  // Redirect to new entries endpoint
  const user_id = req.query.user_id || "default_user";
  const url = `${SERVICES.journal}/journal/entries?user_id=${encodeURIComponent(user_id)}`;
  await proxyRequest(url, req, res);
});

app.get("/journal-insights", async (req, res) => {
  if (ensureServiceAvailable("journal", res) !== true) {
    return;
  }
  // Redirect to new insights endpoint
  const user_id = req.query.user_id || "default_user";
  const url = `${SERVICES.journal}/journal/insights?user_id=${encodeURIComponent(user_id)}`;
  await proxyRequest(url, req, res);
});

// ---------------------------
// Health Check
// ---------------------------
app.get("/health", async (req, res) => {
  const mongoStatus = await checkMongoConnection();
  const status =
    mongoStatus.status === "ok" && mongooseConnected ? "ok" : "degraded";

  res.json({
    status,
    server: "Combined Main Server with Auth",
    services: {
      text: SERVICES.text ? `${SERVICES.text}/analyze` : "not_configured",
      face: SERVICES.face ? `${SERVICES.face}/analyze_face` : "not_configured",
      speech: SERVICES.speech ? `${SERVICES.speech}/analyze_speech` : "not_configured",
      journal: SERVICES.journal ? `${SERVICES.journal}/journal` : "not_configured",
      mongoose: {
        status: mongooseConnected ? "ok" : "error",
        uri_source: mongoUriSource || "missing",
      },
      mongodb: mongoStatus,
      auth: "integrated",
      progress: "integrated"
    },
  });
});

// ---------------------------
// Default route for development
// ---------------------------
app.get("/", (req, res) => {
  res.json({
    message: "FeelWise Combined Main Server with Authentication",
    endpoints: [
      // Analysis endpoints
      "POST /analyze - Text analysis",
      "POST /analyze-face - Face emotion analysis", 
      "POST /analyze-speech - Speech emotion analysis",
      
      // Journal endpoints
      "GET /journal/prompts - Get random prompt",
      "POST /journal/analyze - Analyze journal text",
      "POST /journal/entry - Save journal entry",
      "GET /journal/entries - Get journal entries", 
      "GET /journal/insights - Get mood trends & insights",
      "DELETE /journal/entry/:id - Delete journal entry",
      
      // Authentication endpoints
      "POST /api/auth/register - User registration",
      "POST /api/auth/login - User login",
      "GET /api/auth/profile - Get user profile",
      "PUT /api/auth/profile - Update user profile",
      
      // Progress endpoints
      "GET /api/progress - Get user progress",
      "POST /api/progress - Save progress data",
      
      // System endpoints
      "GET /health - Health check"
    ]
  });
});

// ---------------------------
// Error handling middleware
// ---------------------------
app.use((error, req, res, next) => {
  console.error(`🟥 [${req._rid || 'unknown'}] Server error:`, error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

// ---------------------------
// Start server
// ---------------------------
app.listen(PORT, () => {
  console.log(`\n🚀 [NODE] Combined Main Server with Auth running on ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
  console.log(`🔗 Analysis endpoints:`);
  console.log(`   POST /analyze            → ${SERVICES.text}/analyze`);
  console.log(`   POST /analyze-face       → ${SERVICES.face}/analyze_face`);
  console.log(`   POST /analyze-speech     → ${SERVICES.speech}/analyze_speech`);
  console.log(`🔗 Journal endpoints:`);
  console.log(`   GET  /journal/prompts    → ${SERVICES.journal}/journal/prompts`);
  console.log(`   POST /journal/analyze    → ${SERVICES.journal}/journal/analyze`);
  console.log(`   POST /journal/entry      → ${SERVICES.journal}/journal/entry`);
  console.log(`   GET  /journal/entries    → ${SERVICES.journal}/journal/entries`);
  console.log(`   GET  /journal/insights   → ${SERVICES.journal}/journal/insights`);
  console.log(`   DELETE /journal/entry/:id → ${SERVICES.journal}/journal/entry/:id`);
  console.log(`🔗 Authentication endpoints:`);
  console.log(`   POST /api/auth/register  → Local auth handling`);
  console.log(`   POST /api/auth/login     → Local auth handling`);
  console.log(`   GET  /api/auth/profile   → Local auth handling`);
  console.log(`   PUT  /api/auth/profile   → Local auth handling`);
  console.log(`🔗 Progress endpoints:`);
  console.log(`   GET  /api/progress       → Local progress handling`);
  console.log(`   POST /api/progress       → Local progress handling`);
  console.log(`🔗 System endpoints:`);
  console.log(`   GET  /health`);
  console.log(`\n🌐 Frontend can be served from any HTTP server on allowed origins.`);
});
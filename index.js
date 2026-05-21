import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

const app = express();

/**
 * =========================
 * SAFE SERVER INITIALIZATION
 * =========================
 */

// Ensure required runtime folders exist (Render-safe)
const uploadDir = "/tmp/uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Make upload path available globally if needed elsewhere
global.UPLOAD_DIR = uploadDir;

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/**
 * =========================
 * BASIC ROUTES
 * =========================
 */

app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "operion-backend",
  });
});

/**
 * =========================
 * FEATURE ROUTES
 * =========================
 */

app.use("/health", healthRoutes);
app.use("/api/contracts", contractRoutes);

/**
 * =========================
 * ERROR HANDLING (IMPORTANT)
 * =========================
 */

app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
});

/**
 * =========================
 * START SERVER
 * =========================
 */

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
});

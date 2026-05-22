import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ======================================================
// FIX RENDER ENOENT ISSUE
// Auto-create uploads folder on startup
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ uploads folder created");
} else {
  console.log("✅ uploads folder exists");
}

// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {
  res.json({
    status: "alive"
  });
});

// ======================================================
// ROUTES
// ======================================================

app.use("/health", healthRoutes);
app.use("/api/contracts", contractRoutes);

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

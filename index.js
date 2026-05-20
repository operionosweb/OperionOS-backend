import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

dotenv.config();

const app = express();

/* =========================
   SECURITY + CORS
========================= */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================
   BODY LIMITS (IMPORTANT FOR PDF BASE64 / LARGE PAYLOADS)
========================= */

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================
   ROOT HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Decision OS Live",
    layer: "Unified Aviation Intelligence System",
    architecture: "Modular Backend",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   ROUTES
========================= */

app.use("/health", healthRoutes);
app.use("/api/contracts", contractRoutes);

/* =========================
   GLOBAL ERROR HANDLER (CRITICAL FOR DEBUGGING RENDER DEPLOYS)
========================= */

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

/* =========================
   SERVER
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});

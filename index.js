import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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
   BODY LIMITS
========================= */

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================
   ROUTES (FIXED ESM IMPORT HANDLING)
========================= */

// Dynamic imports to avoid "default export" crashes on Render
const healthRoutesModule = await import("./routes/healthRoutes.js");
const contractRoutesModule = await import("./routes/contractRoutes.js");

// Safe resolution (supports default OR named exports OR CommonJS interop)
const healthRoutes =
  healthRoutesModule.default ||
  healthRoutesModule.router ||
  healthRoutesModule;

const contractRoutes =
  contractRoutesModule.default ||
  contractRoutesModule.router ||
  contractRoutesModule.contractRoutes ||
  contractRoutesModule;

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
   GLOBAL ERROR HANDLER
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

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

dotenv.config();

const app = express();

/* =========================
   BASIC MIDDLEWARE
========================= */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================
   ROOT ROUTE (IMPORTANT FOR DEBUGGING)
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "Operion backend alive",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   ROUTES (CRITICAL)
========================= */

app.use("/health", healthRoutes);
app.use("/api/contracts", contractRoutes);

/* =========================
   ERROR HANDLER
========================= */

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal Server Error"
  });
});

/* =========================
   START SERVER (IMPORTANT)
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion backend running on port ${PORT}`);
});

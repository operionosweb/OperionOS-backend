import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import healthRoutes from "./routes/healthRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Decision OS Live",
    layer: "Unified Aviation Intelligence System",
    architecture: "Modular Backend",
  });
});

/* =========================
   ROUTES
========================= */

app.use("/health", healthRoutes);

app.use("/api/contracts", contractRoutes);

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});

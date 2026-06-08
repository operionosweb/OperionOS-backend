import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/**
 * ROUTES
 */
import contractRoutes from "./routes/contractRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import copilotRoutes from "./routes/copilotRoutes.js";
import internalRoutes from "./routes/internalRoutes.js";

dotenv.config();

const app = express();

/* =========================================
   MIDDLEWARE
========================================= */

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

/* =========================================
   TEMP AUTH (DEV ONLY)
========================================= */

app.use((req, res, next) => {
  req.user = {
    id: "b8e9cfc7-4fdf-4046-b981-fb67e94f5cbb",
    role: "super_admin",
  };
  next();
});

/* =========================================
   ROOT
========================================= */

app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "OperionOS Backend",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================
   ROUTES
========================================= */

app.use("/api/contracts", contractRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/copilot", copilotRoutes);

/* 🔥 NEW INTERNAL SYSTEM */
app.use("/api/internal", internalRoutes);

/* =========================================
   404
========================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/* =========================================
   START SERVER
========================================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 OperionOS running on port ${PORT}`);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/**
 * ROUTES
 */

// EXISTING ROUTES
import contractRoutes from "./routes/contractRoutes.js";
import providerRoutes from "./routes/providerRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import metricsRoutes from "./routes/metricsRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import authRoutes from "./routes/authRoutes.js";

// COPILOT (CURRENT WORKING SYSTEM)
import copilotRoutes from "./routes/copilotRoutes.js";

/**
 * ⚠️ OPERION ORCHESTRATOR TEMPORARILY DISABLED
 *
 * Reason:
 * ESM migration not finished.
 * Prevents backend startup.
 *
 * We'll re-enable after engine standardization.
 */

// import operionRoutes from "./routes/operionRoutes.js";

dotenv.config();

const app = express();

/**
 * =========================================
 * MIDDLEWARE
 * =========================================
 */

app.use(cors());

app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

/**
 * TEMP AUTH (DEV ONLY)
 */

app.use((req, res, next) => {
  req.user = {
    id: "b8e9cfc7-4fdf-4046-b981-fb67e94f5cbb",
    role: "super_admin",
    org_id: "default-org",
  };

  next();
});

/**
 * =========================================
 * ROOT
 * =========================================
 */

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "alive",
    service: "OperionOS Backend",
    version: "2.0-stable",
    timestamp: new Date().toISOString(),
  });
});

/**
 * =========================================
 * API ROUTES
 * =========================================
 */

app.use("/api/contracts", contractRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/dashboard", dashboardRoutes);

/**
 * COPILOT
 */

app.use("/api/copilot", copilotRoutes);

/**
 * ADMIN
 */

app.use("/api/admin", adminRoutes);

/**
 * HEALTH
 */

app.use("/api/health", healthRoutes);

/**
 * =========================================
 * 404 HANDLER
 * =========================================
 */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/**
 * =========================================
 * SERVER
 * =========================================
 */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 OperionOS running on port ${PORT}`);
});

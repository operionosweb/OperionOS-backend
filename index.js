import express from "express";
import cors from "cors";
import dotenv from "dotenv";

/**
 * =========================================
 * ROUTES
 * =========================================
 */

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

import copilotRoutes from "./routes/copilotRoutes.js";
import operionRoutes from "./routes/operionRoutes.js";
import operionDashboardRoutes from "./routes/operionDashboardRoutes.js";

/**
 * 🧠 HORIZON SYNC LAYER (STEP 9C)
 */
import horizonRoutes from "./routes/horizonRoutes.js";

/**
 * 🧠 SYSTEM DIAGNOSTICS (STEP 11A)
 */
import systemRoutes from "./routes/systemRoutes.js";

/**
 * 🧪 BACKEND VERIFICATION SUITE (STEP 11B)
 */
import verificationRoutes from "./routes/verificationRoutes.js";

/**
 * 🧠 TENANT SYSTEM (SAAS CORE)
 */
import { tenantContext } from "./middleware/tenantContext.js";

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
 * 🧠 TENANT CONTEXT (MUST BE BEFORE ROUTES)
 */
app.use(tenantContext);

/**
 * =========================================
 * ROOT
 * =========================================
 */

app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "OperionOS Backend",
    version: "2.3-saas-verification",
    tenant: req.tenant || null,
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
 * COPILOT AI SYSTEM
 */
app.use("/api/copilot", copilotRoutes);

/**
 * OPERION CORE SYSTEM
 */
app.use("/api/operion", operionRoutes);
app.use("/api/operion/dashboard", operionDashboardRoutes);

/**
 * 🧠 HORIZON SYNC API (STEP 9C)
 */
app.use("/api/horizon", horizonRoutes);

/**
 * 🧠 SYSTEM DIAGNOSTICS API (STEP 11A)
 */
app.use("/api/system", systemRoutes);

/**
 * 🧪 BACKEND VERIFICATION SUITE (STEP 11B)
 */
app.use("/api/verification", verificationRoutes);

/**
 * ADMIN
 */
app.use("/api/admin", adminRoutes);

/**
 * HEALTH CHECK
 */
app.use("/api/health", healthRoutes);

/**
 * =========================================
 * 404 HANDLER
 * =========================================
 */

app.use((req, res) => {
  res.status(404).json({
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
  console.log(`🧠 SaaS tenant system ACTIVE`);
  console.log(`📡 Horizon Sync API ACTIVE (/api/horizon)`);
  console.log(`🩺 System Diagnostics ACTIVE (/api/system/status)`);
  console.log(`🧪 Backend Verification ACTIVE (/api/verification)`);
});
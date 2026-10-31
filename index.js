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
import authRoutes from "./routes/authRoutes.js";
import foundationRoutes from "./routes/foundationRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import analysisRunRoutes from "./routes/analysisRunRoutes.js";
import aviationRoutes from "./routes/aviationRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import weatherMapRoutes from "./routes/weatherMapRoutes.js";
import platformRoutes from "./routes/platformRoutes.js";
import commercialIntelligenceRoutes from "./routes/commercialIntelligenceRoutes.js";
import ociRoutes from "./routes/ociRoutes.js";
import ociAccessRoutes from "./routes/ociAccessRoutes.js";
import { createOciRateLimit, ociHttpBoundary } from "./middleware/ociAccessMiddleware.js";

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
app.set("trust proxy", 1);

/**
 * =========================================
 * MIDDLEWARE
 * =========================================
 */

app.use("/api/oci", ociHttpBoundary, createOciRateLimit(), express.json({ limit: "64kb" }), ociAccessRoutes, ociRoutes, (_req, res) => {
  res.status(404).json({ success: false, code: "OCI_ROUTE_NOT_FOUND", error: "OCI endpoint not found." });
});
app.use("/api/oci", (error, _req, res, _next) => {
  const status = error.type === "entity.too.large" ? 413 : error instanceof SyntaxError ? 400 : 500;
  if (status === 500) console.error("OCI request processing failed");
  res.status(status).json({ success: false, code: "OCI_REQUEST_REJECTED", error: status === 413 ? "OCI request is too large." : status === 400 ? "Invalid JSON request." : "OCI request failed." });
});
app.use(cors());
app.use("/api/weather-maps", weatherMapRoutes);

app.use(
  "/api/contact",
  express.json({ limit: "16kb" }),
  contactRoutes
);

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
app.use("/api/foundation", foundationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/analysis-runs", analysisRunRoutes);
app.use("/api/aviation", aviationRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/intelligence", commercialIntelligenceRoutes);
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
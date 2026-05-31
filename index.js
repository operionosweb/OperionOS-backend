// index.js

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
import mediaRoutes from "./routes/mediaRoutes.js";

/**
 * AUTH MIDDLEWARE
 */
import { apiKeyMiddleware } from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();

/**
 * =========================================
 * GLOBAL MIDDLEWARE
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
 * =========================================
 * ROOT (PUBLIC HEALTH CHECK)
 * =========================================
 */

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "alive",
    service: "OperionOS Backend",
    timestamp: new Date().toISOString(),
  });
});

/**
 * =========================================
 * PUBLIC ROUTES (NO AUTH)
 * =========================================
 * These are safe endpoints like search or blog reading
 */

app.use("/api/search", searchRoutes);
app.use("/api/blog", blogRoutes);

/**
 * =========================================
 * PROTECTED ROUTES (API KEY REQUIRED)
 * =========================================
 * Everything below requires INTERNAL_API_KEY
 */

app.use(apiKeyMiddleware);

app.use("/api/contracts", contractRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/media", mediaRoutes);

/**
 * =========================================
 * ADMIN ROUTES (STRICTLY PROTECTED)
 * =========================================
 */

app.use("/api/admin", adminRoutes);

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

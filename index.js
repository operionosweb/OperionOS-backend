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
 * =========================================
 * ROOT
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
 * API ROUTES
 * =========================================
 */

app.use(
  "/api/contracts",
  contractRoutes
);

app.use(
  "/api/providers",
  providerRoutes
);

app.use(
  "/api/search",
  searchRoutes
);

app.use(
  "/api/portfolio",
  portfolioRoutes
);

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

const PORT =
  process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(
    `🚀 OperionOS running on port ${PORT}`
  );
});

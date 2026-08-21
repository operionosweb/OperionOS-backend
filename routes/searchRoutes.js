// routes/searchRoutes.js

import express from "express";

import {
  searchContracts,
} from "../services/searchService.js";

import {
  semanticSearch,
} from "../services/semanticSearchService.js";
import { authenticateUser } from "../middleware/userAuthMiddleware.js";
import { requireOrganizationMembership } from "../middleware/organizationMiddleware.js";
import { requireOrganizationPermission } from "../middleware/authorizationMiddleware.js";

const router = express.Router();

router.use(
  authenticateUser,
  requireOrganizationMembership,
  requireOrganizationPermission("contract:read")
);

/**
 * =========================================
 * STANDARD SEARCH
 * =========================================
 *
 * GET /api/search?q=aircraft
 * GET /api/search?q=lease&type=Aircraft Lease Agreement
 * GET /api/search?minRisk=50
 *
 */

router.get("/", async (req, res) => {
  try {
    const {
      q = "",
      type = "",
      provider = "",
      minRisk = 0,
    } = req.query;

    const results = await searchContracts({
      query: q,
      type,
      provider,
      minRisk: Number(minRisk),
      organizationId: req.organization.id,
    });

    return res.status(200).json(results);

  } catch (error) {
    console.error("Search Route Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Search failed",
    });
  }
});

/**
 * =========================================
 * SEMANTIC VECTOR SEARCH
 * =========================================
 *
 * GET /api/search/semantic?q=aircraft leasing obligations
 *
 */

router.get("/semantic", async (req, res) => {
  try {
    const {
      q = "",
      limit = 5,
    } = req.query;

    const results = await semanticSearch(
      q,
      Number(limit),
      req.organization.id
    );

    return res.status(200).json(results);

  } catch (error) {
    console.error(
      "Semantic Search Route Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Semantic search failed",
    });
  }
});

export default router;

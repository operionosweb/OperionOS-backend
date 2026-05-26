// routes/searchRoutes.js

import express from "express";

import {
  searchContracts,
} from "../services/searchService.js";

const router = express.Router();

/**
 * =========================================
 * SEARCH CONTRACTS
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

export default router;

// routes/searchRoutes.js

import express from "express";

import {
  semanticSearch,
} from "../services/semanticSearchService.js";

const router = express.Router();

/**
 * =========================================
 * SEMANTIC SEARCH
 * =========================================
 */

router.post("/", async (req, res) => {
  try {
    const {
      query,
      limit,
    } = req.body;

    const result =
      await semanticSearch(
        query,
        limit || 5
      );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error(
      "Search Route Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Search failed",
    });
  }
});

export default router;

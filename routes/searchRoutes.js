// routes/searchRoutes.js

import express from "express";

import supabase from "../config/supabase.js";

import {
  semanticSearch,
} from "../services/semanticSearchService.js";

const router = express.Router();

/**
 * =========================================
 * KEYWORD SEARCH
 * =========================================
 */

router.get("/", async (req, res) => {
  try {
    const query =
      req.query.q || "";

    const { data, error } =
      await supabase
        .from("contracts")
        .select("*")
        .or(
          `
          filename.ilike.%${query}%,
          contract_type.ilike.%${query}%,
          supplier_name.ilike.%${query}%,
          summary.ilike.%${query}%
        `
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      total_results: data.length,
      results: data,
      search_type: "keyword",
    });
  } catch (error) {
    console.error(
      "Keyword Search Error:",
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

/**
 * =========================================
 * SEMANTIC SEARCH
 * =========================================
 */

router.get(
  "/semantic",
  async (req, res) => {
    try {
      const query =
        req.query.q || "";

      const limit = Number(
        req.query.limit || 5
      );

      const result =
        await semanticSearch(
          query,
          limit
        );

      if (!result.success) {
        return res.status(400).json(
          result
        );
      }

      return res.status(200).json(
        result
      );
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
  }
);

export default router;

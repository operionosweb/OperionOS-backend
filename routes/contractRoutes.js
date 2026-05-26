// routes/contractRoutes.js

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

import {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract,
} from "../services/contractService.js";

import { apiKeyMiddleware } from "../middleware/apiKeyMiddleware.js";

const router = express.Router();

/**
 * =========================================
 * MULTER CONFIG
 * =========================================
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

/**
 * =========================================
 * DEBUG MIDDLEWARE (TEMP - SAFE)
 * =========================================
 */

function debugHeaders(req, res, next) {
  console.log("🔥 REQUEST HEADERS:", req.headers);
  console.log("🔥 API KEY HEADER:", req.headers["x-api-key"]);
  next();
}

/**
 * =========================================
 * HEALTH CHECK
 * =========================================
 */

router.get("/health", async (req, res) => {
  return res.status(200).json({
    success: true,
    service: "contract-routes",
    status: "operational",
  });
});

/**
 * =========================================
 * UPLOAD CONTRACT (PROTECTED)
 * =========================================
 */

router.post(
  "/upload",
  debugHeaders,
  apiKeyMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      let extractedText = "";

      try {
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text || "";
      } catch (err) {
        console.error("PDF Parse Error:", err);

        return res.status(500).json({
          success: false,
          error: "Failed to extract PDF text",
        });
      }

      if (!extractedText || extractedText.length < 100) {
        return res.status(400).json({
          success: false,
          error: "Document text too short or unreadable",
        });
      }

      const result = await createContract({
        text: extractedText,
        filename: req.file.originalname,
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error("Upload Route Error:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Upload failed",
      });
    }
  }
);

/**
 * =========================================
 * CREATE CONTRACT (JSON) - PROTECTED
 * =========================================
 */

router.post("/", debugHeaders, apiKeyMiddleware, async (req, res) => {
  try {
    const result = await createContract(req.body);

    return res.status(201).json(result);
  } catch (error) {
    console.error("Create Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * =========================================
 * GET ALL CONTRACTS
 * =========================================
 */

router.get("/", async (req, res) => {
  try {
    const result = await getAllContracts();

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Contracts Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch contracts",
    });
  }
});

/**
 * =========================================
 * GET CONTRACT BY ID
 * =========================================
 */

router.get("/:id", async (req, res) => {
  try {
    const result = await getContractById(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch contract",
    });
  }
});

/**
 * =========================================
 * UPDATE CONTRACT (PROTECTED)
 * =========================================
 */

router.put("/:id", debugHeaders, apiKeyMiddleware, async (req, res) => {
  try {
    const result = await updateContract(req.params.id, req.body);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Update Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Update failed",
    });
  }
});

/**
 * =========================================
 * DELETE CONTRACT (PROTECTED)
 * =========================================
 */

router.delete("/:id", debugHeaders, apiKeyMiddleware, async (req, res) => {
  try {
    const result = await deleteContract(req.params.id);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Delete Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Delete failed",
    });
  }
});

export default router;

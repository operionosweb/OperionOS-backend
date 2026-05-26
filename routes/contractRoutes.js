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

const router = express.Router();

/**
 * =========================================
 * INTERNAL API KEY MIDDLEWARE
 * =========================================
 */

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "Missing API key",
    });
  }

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(403).json({
      success: false,
      error: "Invalid API key",
    });
  }

  next();
}

/**
 * =========================================
 * MULTER CONFIG
 * =========================================
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

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
 * UPLOAD CONTRACT (MUST BE FIRST BEFORE /:id)
 * =========================================
 */

router.post(
  "/upload",
  apiKeyAuth,
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
 * CREATE CONTRACT (JSON)
 * =========================================
 */

router.post("/", apiKeyAuth, async (req, res) => {
  try {
    const result = await createContract(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

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
 * GET CONTRACT BY ID (MUST BE AFTER /upload)
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
 * UPDATE CONTRACT
 * =========================================
 */

router.put("/:id", apiKeyAuth, async (req, res) => {
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
 * DELETE CONTRACT
 * =========================================
 */

router.delete("/:id", apiKeyAuth, async (req, res) => {
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

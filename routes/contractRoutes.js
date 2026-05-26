// routes/contractRoutes.js

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

/**
 * SERVICES
 */

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
    timestamp: new Date().toISOString(),
  });
});

/**
 * =========================================
 * CREATE CONTRACT (JSON BODY)
 * =========================================
 */

router.post("/", async (req, res) => {
  try {
    const { text, filename, fileId } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        error: "Valid contract text is required",
      });
    }

    const result = await createContract({
      text,
      filename,
      fileId,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      contract: result.contract,
    });
  } catch (error) {
    console.error("Create Contract Route Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

/**
 * =========================================
 * PDF UPLOAD PIPELINE
 * =========================================
 */

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    /**
     * VALIDATE FILE
     */

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    /**
     * EXTRACT PDF TEXT
     */

    let extractedText = "";

    try {
      const parsed = await pdfParse(req.file.buffer);

      extractedText = parsed?.text || "";
    } catch (error) {
      console.error("PDF Parse Error:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to parse PDF",
      });
    }

    /**
     * VALIDATE EXTRACTION
     */

    if (!extractedText || extractedText.length < 100) {
      return res.status(400).json({
        success: false,
        error: "PDF text extraction failed or insufficient text",
      });
    }

    /**
     * CREATE CONTRACT
     */

    const result = await createContract({
      text: extractedText,
      filename: req.file.originalname,
      fileId: null,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || "Contract processing failed",
      });
    }

    /**
     * SUCCESS RESPONSE
     */

    return res.status(201).json({
      success: true,

      filename: req.file.originalname,

      extracted_characters: extractedText.length,

      contract: result.contract,
    });
  } catch (error) {
    console.error("Upload Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Upload failed",
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

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

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
      return res.status(404).json({
        success: false,
        error: result.error,
      });
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

router.put("/:id", async (req, res) => {
  try {
    const result = await updateContract(
      req.params.id,
      req.body
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

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

router.delete("/:id", async (req, res) => {
  try {
    const result = await deleteContract(req.params.id);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error("Delete Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Delete failed",
    });
  }
});

export default router;

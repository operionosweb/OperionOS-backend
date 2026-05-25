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
 * -----------------------------------------
 * MULTER CONFIG (STABLE UPLOAD HANDLING)
 * -----------------------------------------
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

/**
 * -----------------------------------------
 * HEALTH CHECK
 * -----------------------------------------
 */

router.get("/health", async (req, res) => {
  return res.status(200).json({
    success: true,
    service: "contract-routes",
    status: "operational",
  });
});

/**
 * -----------------------------------------
 * CREATE CONTRACT (MANUAL JSON)
 * -----------------------------------------
 */

router.post("/", async (req, res) => {
  try {
    const result = await createContract(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      contract: result.contract,
      duplicate_detected: result.duplicate_detected || false,
      duplicate_of: result.duplicate_of || null,
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
 * -----------------------------------------
 * UPLOAD CONTRACT (PDF PIPELINE ONLY)
 * -----------------------------------------
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
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text || "";
    } catch (err) {
      console.error("PDF Parse Error:", err);

      return res.status(500).json({
        success: false,
        error: "Failed to extract PDF text",
      });
    }

    /**
     * VALIDATE TEXT QUALITY
     */
    if (!extractedText || extractedText.length < 100) {
      return res.status(400).json({
        success: false,
        error: "Document text too short or unreadable",
      });
    }

    /**
     * CREATE CONTRACT (ALL AI + LOGIC HANDLED IN SERVICE LAYER)
     */
    const result = await createContract({
      name: req.file.originalname,
      raw_text: extractedText,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || "Contract creation failed",
      });
    }

    /**
     * RESPONSE (CLEAN + CONSISTENT)
     */
    return res.status(201).json({
      success: true,

      filename: req.file.originalname,

      contract: result.contract,

      duplicate_detected: result.duplicate_detected || false,

      duplicate_of: result.duplicate_of || null,

      analysis_provider: result.analysis_provider || null,
    });
  } catch (error) {
    console.error("Upload Route Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Upload failed",
    });
  }
});

/**
 * -----------------------------------------
 * GET ALL CONTRACTS
 * -----------------------------------------
 */

router.get("/", async (req, res) => {
  try {
    const contracts = await getAllContracts();

    return res.status(200).json({
      success: true,
      contracts,
    });
  } catch (error) {
    console.error("Get Contracts Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch contracts",
    });
  }
});

/**
 * -----------------------------------------
 * GET CONTRACT BY ID
 * -----------------------------------------
 */

router.get("/:id", async (req, res) => {
  try {
    const contract = await getContractById(req.params.id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: "Contract not found",
      });
    }

    return res.status(200).json({
      success: true,
      contract,
    });
  } catch (error) {
    console.error("Get Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch contract",
    });
  }
});

/**
 * -----------------------------------------
 * UPDATE CONTRACT
 * -----------------------------------------
 */

router.put("/:id", async (req, res) => {
  try {
    const result = await updateContract(req.params.id, req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      contract: result.contract,
    });
  } catch (error) {
    console.error("Update Contract Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Update failed",
    });
  }
});

/**
 * -----------------------------------------
 * DELETE CONTRACT
 * -----------------------------------------
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
      message: "Contract deleted successfully",
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

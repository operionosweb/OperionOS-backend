// routes/contractRoutes.js

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

/**
 * Services
 */
import {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  deleteContract,
} from "../services/contractService.js";

import {
  extractContractIntelligence,
} from "../services/aiExtractionService.js";

const router = express.Router();

/**
 * -----------------------------------------
 * MULTER CONFIG
 * -----------------------------------------
 */

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

/**
 * -----------------------------------------
 * HEALTH CHECK
 * -----------------------------------------
 */

router.get(
  "/health",
  async (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        "Contract routes operational",
    });
  }
);

/**
 * -----------------------------------------
 * POST /contracts
 * Create contract manually
 * -----------------------------------------
 */

router.post(
  "/",
  async (req, res) => {
    try {
      const result =
        await createContract(
          req.body
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(201).json({
        success: true,
        contract:
          result.contract,
      });
    } catch (error) {
      console.error(
        "Create Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to create contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * POST /contracts/upload
 * Upload + Analyze Contract
 * -----------------------------------------
 */

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      /**
       * Validate file
       */

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error:
            "No file uploaded",
        });
      }

      /**
       * -----------------------------------------
       * EXTRACT PDF TEXT
       * -----------------------------------------
       */

      let extractedText = "";

      try {
        const pdfData =
          await pdfParse(
            req.file.buffer
          );

        extractedText =
          pdfData.text || "";
      } catch (pdfError) {
        console.error(
          "PDF Parse Error:",
          pdfError
        );

        return res.status(500).json({
          success: false,
          error:
            "Failed to extract PDF text",
        });
      }

      /**
       * Validate text
       */

      if (
        !extractedText ||
        extractedText.length < 100
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Document contains insufficient readable text",
        });
      }

      /**
       * -----------------------------------------
       * AI EXTRACTION
       * -----------------------------------------
       */

      const intelligence =
        await extractContractIntelligence(
          extractedText
        );

      /**
       * Actual extracted analysis
       */

      const analysis =
        intelligence?.analysis ||
        {};

      /**
       * -----------------------------------------
       * SAVE CONTRACT
       * -----------------------------------------
       */

      const result =
        await createContract({
          name:
            req.file.originalname,

          supplier_name:
            analysis?.supplier_name ||
            "Unknown Supplier",

          raw_text:
            extractedText,

          contract_type:
            analysis?.contract_type ||
            "General Contract",

          risk_score:
            analysis?.risk_score ||
            0,

          clauses:
            analysis?.clauses ||
            [],

          obligations:
            analysis?.obligations ||
            [],

          summary:
            analysis?.summary ||
            "",

          value:
            analysis?.contract_value ||
            0,

          start_date:
            analysis?.start_date ||
            null,

          expiry_date:
            analysis?.expiry_date ||
            null,
        });

      /**
       * -----------------------------------------
       * RESPONSE
       * -----------------------------------------
       */

      return res.status(201).json({
        success: true,

        filename:
          req.file.originalname,

        cached:
          intelligence?.cached ||
          false,

        cache_source:
          intelligence?.cache_source ||
          null,

        document_hash:
          intelligence?.document_hash ||
          null,

        extracted_text_preview:
          extractedText.substring(
            0,
            1000
          ),

        analysis,

        contract:
          result.contract,
      });
    } catch (error) {
      console.error(
        "Upload Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to upload and analyze contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /contracts
 * -----------------------------------------
 */

router.get(
  "/",
  async (req, res) => {
    try {
      const contracts =
        await getAllContracts();

      return res.status(200).json({
        success: true,
        contracts,
      });
    } catch (error) {
      console.error(
        "Get Contracts Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to fetch contracts",
      });
    }
  }
);

/**
 * -----------------------------------------
 * GET /contracts/:id
 * -----------------------------------------
 */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const contract =
        await getContractById(
          req.params.id
        );

      if (!contract) {
        return res.status(404).json({
          success: false,
          error:
            "Contract not found",
        });
      }

      return res.status(200).json({
        success: true,
        contract,
      });
    } catch (error) {
      console.error(
        "Get Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to fetch contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * PUT /contracts/:id
 * -----------------------------------------
 */

router.put(
  "/:id",
  async (req, res) => {
    try {
      const result =
        await updateContract(
          req.params.id,
          req.body
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        contract:
          result.contract,
      });
    } catch (error) {
      console.error(
        "Update Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to update contract",
      });
    }
  }
);

/**
 * -----------------------------------------
 * DELETE /contracts/:id
 * -----------------------------------------
 */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const result =
        await deleteContract(
          req.params.id
        );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Contract deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete Contract Route Error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to delete contract",
      });
    }
  }
);

export default router;

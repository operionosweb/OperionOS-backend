// routes/contractRoutes.js

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import crypto from "crypto";

/**
 * Services
 */
import supabase from "../config/supabase.js";

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
 * HASH GENERATOR
 * -----------------------------------------
 */

function generateHash(
  text = ""
) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

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
 * Upload + Duplicate Detection
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
       * GENERATE HASH
       * -----------------------------------------
       */

      const documentHash =
        generateHash(
          extractedText
        );

      /**
       * -----------------------------------------
       * DUPLICATE DETECTION
       * -----------------------------------------
       */

      const {
        data: existingContract,
      } = await supabase
        .from("contracts")
        .select("*")
        .eq(
          "document_hash",
          documentHash
        )
        .limit(1)
        .maybeSingle();

      /**
       * Allow override
       */

      const forceSave =
        req.body.force_save ===
        "true";

      /**
       * -----------------------------------------
       * DUPLICATE FOUND
       * -----------------------------------------
       */

      if (
        existingContract &&
        !forceSave
      ) {
        return res.status(200).json({
          success: true,

          duplicate_detected: true,

          message:
            "This contract already exists in the system.",

          existing_contract: {
            id:
              existingContract.id,

            name:
              existingContract.name,

            created_at:
              existingContract.created_at,

            supplier_name:
              existingContract.supplier_name,

            contract_type:
              existingContract.contract_type,
          },

          action_required:
            "Set force_save=true to store anyway.",
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

          document_hash:
            documentHash,

          duplicate_of:
            existingContract?.id ||
            null,

          is_duplicate:
            !!existingContract,

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

        duplicate_detected:
          !!existingContract,

        duplicate_of:
          existingContract?.id ||
          null,

        filename:
          req.file.originalname,

        cached:
          intelligence?.cached ||
          false,

        cache_source:
          intelligence?.cache_source ||
          null,

        document_hash:
          documentHash,

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
        await getAll

import express from "express";
import fs from "fs";

import { upload } from "../services/uploadService.js";
import { extractClauses } from "../services/clauseParser.js";
import { extractObligations } from "../services/obligationParser.js";
import { saveContractToDB } from "../services/contractService.js";

const router = express.Router();

// ======================================================
// CONTRACT UPLOAD + PROCESSING
// ======================================================

router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      // =========================================
      // 1. CHECK FILE
      // =========================================

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded"
        });
      }

      // =========================================
      // 2. READ FILE CONTENT
      // =========================================

      const extractedText = fs.readFileSync(
        req.file.path,
        "utf8"
      );

      // =========================================
      // 3. EXTRACT CLAUSES
      // =========================================

      const clauses = extractClauses(extractedText);

      // =========================================
      // 4. EXTRACT OBLIGATIONS
      // =========================================

      const obligations = extractObligations(clauses);

      // =========================================
      // 5. BUILD FINAL PAYLOAD
      // =========================================

      const finalPayload = {
        filename: req.file.originalname,
        extracted_text: extractedText,
        clauses,
        obligations
      };

      // =========================================
      // 6. SAVE TO SUPABASE
      // =========================================

      const dbResult = await saveContractToDB(finalPayload);

      // =========================================
      // 7. RESPONSE
      // =========================================

      return res.json({
        success: true,
        extraction: {
          filename: req.file.originalname,
          clausesDetected: clauses.length,
          obligationsDetected: obligations.length,
          clauses,
          obligations
        },
        database: dbResult
      });

    } catch (err) {
      console.error("UPLOAD PIPELINE ERROR:", err);

      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);

export default router;

import express from "express";
import fs from "fs";
import pdfParse from "pdf-parse";

import { upload } from "../services/uploadService.js";
import { extractClauses } from "../services/clauseParser.js";
import { extractObligations } from "../services/obligationParser.js";
import { saveContractToDB } from "../services/contractService.js";
import { analyzeContractRisk } from "../services/contractRiskEngine.js";

const router = express.Router();

// ======================================================
// CONTRACT UPLOAD + AI PROCESSING PIPELINE
// ======================================================

router.post("/upload", upload.single("file"), async (req, res) => {
  try {

    // =========================================
    // 1. VALIDATE FILE
    // =========================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // =========================================
    // 2. READ PDF FILE
    // =========================================

    const dataBuffer = fs.readFileSync(req.file.path);

    // =========================================
    // 3. PARSE PDF TEXT
    // =========================================

    const pdfData = await pdfParse(dataBuffer);

    const extractedText = pdfData.text || "";

    // =========================================
    // 4. AI CLAUSE EXTRACTION
    // =========================================

    const clauses = await extractClauses(extractedText);

    // =========================================
    // 5. AI OBLIGATION EXTRACTION
    // =========================================

    const obligations = await extractObligations(clauses);

    // =========================================
    // 6. AI CONTRACT RISK ENGINE
    // =========================================

    const riskAnalysis =
      await analyzeContractRisk(
        clauses,
        obligations
      );

    // =========================================
    // 7. BUILD FINAL PAYLOAD
    // =========================================

    const finalPayload = {
      filename: req.file.originalname,
      extracted_text: extractedText,
      clauses,
      obligations,
      risk: riskAnalysis,
    };

    // =========================================
    // 8. SAVE TO SUPABASE
    // =========================================

    const dbResult =
      await saveContractToDB(finalPayload);

    // =========================================
    // 9. RESPONSE
    // =========================================

    return res.json({
      success: true,

      extraction: {
        filename: req.file.originalname,

        clausesDetected:
          clauses.length,

        obligationsDetected:
          obligations.length,

        clauses,
        obligations,
        risk: riskAnalysis,
      },

      database: dbResult,
    });

  } catch (err) {

    console.error(
      "UPLOAD PIPELINE ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;

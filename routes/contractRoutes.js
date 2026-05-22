import express from "express";
import fs from "fs";

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
    // 2. READ FILE CONTENT
    // =========================================
    const extractedText = fs.readFileSync(req.file.path, "utf8");

    // =========================================
    // 3. AI CLAUSE EXTRACTION
    // =========================================
    const clauses = await extractClauses(extractedText);

    // =========================================
    // 4. AI OBLIGATION EXTRACTION
    // =========================================
    const obligations = await extractObligations(clauses);

    // =========================================
    // 5. AI CONTRACT RISK ENGINE (NEW)
    // =========================================
    const riskAnalysis = await analyzeContractRisk(clauses, obligations);

    // =========================================
    // 6. BUILD FINAL PAYLOAD
    // =========================================
    const finalPayload = {
      filename: req.file.originalname,
      extracted_text: extractedText,
      clauses,
      obligations,
      risk: riskAnalysis,
    };

    // =========================================
    // 7. SAVE TO SUPABASE
    // =========================================
    const dbResult = await saveContractToDB(finalPayload);

    // =========================================
    // 8. RESPONSE
    // =========================================
    return res.json({
      success: true,
      extraction: {
        filename: req.file.originalname,
        clausesDetected: clauses.length,
        obligationsDetected: obligations.length,
        clauses,
        obligations,
        risk: riskAnalysis,
      },
      database: dbResult,
    });
  } catch (err) {
    console.error("UPLOAD PIPELINE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;

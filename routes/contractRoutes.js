import express from "express";
import fs from "fs";
import pdf from "pdf-parse";

import { upload } from "../services/uploadService.js";
import { extractClauses } from "../services/clauseParser.js";
import { extractObligations } from "../services/obligationParser.js";
import { saveContractToDB } from "../services/contractService.js";

const router = express.Router();

// ======================================================
// CONTRACT UPLOAD + PROCESSING (FIXED PDF PIPELINE)
// ======================================================

router.post("/upload", upload.single("file"), async (req, res) => {
  let filePath;

  try {
    // =========================================
    // 1. CHECK FILE
    // =========================================
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    filePath = req.file.path;

    // =========================================
    // 2. READ PDF (FIXED - NO fs.readFileSync)
    // =========================================
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(fileBuffer);

    const extractedText = pdfData.text || "";

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn("⚠️ PDF extraction returned empty text");
    }

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
      obligations,
    };

    // =========================================
    // 6. SAVE TO SUPABASE
    // =========================================
    const dbResult = await saveContractToDB(finalPayload);

    // =========================================
    // 7. CLEANUP FILE (FIX FOR RENDER ENOENT ISSUES)
    // =========================================
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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
      },
      database: dbResult,
    });
  } catch (err) {
    console.error("UPLOAD PIPELINE ERROR:", err);

    // SAFE CLEANUP ON ERROR
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;

import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";

import { extractClauses, extractObligations } from "../services/clauseExtractionService.js";

const router = express.Router();

// store file in memory (IMPORTANT FIX)
const upload = multer({
  storage: multer.memoryStorage(),
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // ✅ IMPORTANT: this is a BUFFER
    const pdfBuffer = req.file.buffer;

    // ✅ pdf-parse expects BUFFER (this is correct usage)
    const pdfData = await pdfParse(pdfBuffer);

    const text = pdfData.text;

    if (!text) {
      return res.status(500).json({
        success: false,
        error: "No text extracted from PDF",
      });
    }

    // Pipeline
    const clauses = extractClauses(text);
    const obligations = extractObligations(clauses);

    return res.status(200).json({
      success: true,
      contractName: req.file.originalname,
      clausesDetected: clauses.length,
      obligationsDetected: obligations.length,
      extractedTextLength: text.length,
      clauses,
      obligations,
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

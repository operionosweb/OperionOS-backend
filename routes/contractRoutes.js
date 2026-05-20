import express from "express";
import multer from "multer";

import { extractTextFromPDF } from "../services/pdfService.js";
import { extractClauses } from "../services/clauseExtractionService.js";
import { extractObligations } from "../services/obligationExtractor.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    // STEP 1 — Extract PDF text
    const extractedText = await extractTextFromPDF(req.file.path);

    // STEP 2 — Extract clauses
    const clauses = await extractClauses(extractedText);

    // IMPORTANT DEBUG
    console.log("CLAUSES FOUND:", clauses.length);

    // STEP 3 — Extract obligations
    const obligations = await extractObligations(clauses);

    // IMPORTANT DEBUG
    console.log("OBLIGATIONS FOUND:", obligations.length);

    // STEP 4 — Return result
    return res.json({
      success: true,

      contract: {
        contract_name: req.file.originalname,
        extracted_text: extractedText,
      },

      clausesDetected: clauses.length,
      obligationsDetected: obligations.length,

      clauses,
      obligations,

      debug: {
        clausesType: typeof clauses,
        obligationsType: typeof obligations,
        firstClause: clauses[0] || null,
      },
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

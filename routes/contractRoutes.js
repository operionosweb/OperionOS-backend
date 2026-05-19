import express from "express";
import multer from "multer";

import supabase from "../config/supabase.js";

import { extractPdfText } from "../services/pdfService.js";
import { extractClauses } from "../services/clauseExtractionService.js";
import { extractObligations } from "../services/obligationExtractor.js";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

/* =========================
   CONTRACT UPLOAD
========================= */

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const file = req.file;

    /* =========================
       PDF EXTRACTION
    ========================= */

    const extractedText = await extractPdfText(file.buffer);

    /* =========================
       STORAGE UPLOAD
    ========================= */

    const fileName = `${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({
        error: uploadError.message,
      });
    }

    /* =========================
       CONTRACT INSERT
    ========================= */

    const { data: contractData, error: contractError } = await supabase
      .from("contracts")
      .insert([
        {
          contract_name: file.originalname,
          contract_type: "unclassified",
          source_file: fileName,
          extracted_text: extractedText,
        },
      ])
      .select()
      .single();

    if (contractError) {
      return res.status(500).json({
        error: contractError.message,
      });
    }

    /* =========================
       CLAUSE EXTRACTION
    ========================= */

    const clauses = extractClauses(extractedText);

    const clausesToInsert = clauses.map((clause) => ({
      contract_id: contractData.id,
      clause_name: clause.clause_title,
      clause_type: clause.clause_category,
      clause_text: clause.clause_text,
      risk_level: clause.risk_level,
    }));

    let insertedClauses = [];

    if (clausesToInsert.length > 0) {
      const { data, error: clauseError } = await supabase
        .from("contract_clauses")
        .insert(clausesToInsert)
        .select();

      if (clauseError) {
        console.error("Clause insert error:", clauseError);
      } else {
        insertedClauses = data || [];
      }
    }

    /* =========================
       OBLIGATION EXTRACTION
    ========================= */

    const obligations = extractObligations(insertedClauses);

    let insertedObligations = [];

    if (obligations.length > 0) {
      const { data, error: obligationError } = await supabase
        .from("obligations")
        .insert(obligations)
        .select();

      if (obligationError) {
        console.error("Obligation insert error:", obligationError);
      } else {
        insertedObligations = data || [];
      }
    }

    /* =========================
       RESPONSE
    ========================= */

    return res.json({
      success: true,
      contract: contractData,
      clausesDetected: insertedClauses.length,
      obligationsDetected: insertedObligations.length,
      extractedCharacters: extractedText.length,
      extractedPreview: extractedText.substring(0, 500),
    });
  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
});

export default router;

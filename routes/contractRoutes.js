import express from "express";
import multer from "multer";

import { extractTextFromPDF } from "../services/pdfService.js";
import {
  extractClauses,
  extractObligations,
} from "../services/clauseExtractionService.js";

import { supabase } from "../supabaseClient.js";

const router = express.Router();

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

    // STEP 1 — EXTRACT TEXT
    const extractedText = await extractTextFromPDF(req.file.buffer);

    // STEP 2 — CREATE CONTRACT
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .insert([
        {
          contract_name: req.file.originalname,
          extracted_text: extractedText,
        },
      ])
      .select()
      .single();

    if (contractError) {
      throw contractError;
    }

    // STEP 3 — EXTRACT CLAUSES
    const clauses = extractClauses(extractedText);

    // STEP 4 — SAVE CLAUSES
    const clausesToInsert = clauses.map((clause) => ({
      contract_id: contract.id,
      clause_number: clause.clause_number,
      clause_title: clause.clause_title,
      clause_text: clause.clause_text,
      clause_type: clause.clause_type,
    }));

    const { data: savedClauses, error: clausesError } = await supabase
      .from("clauses")
      .insert(clausesToInsert)
      .select();

    if (clausesError) {
      throw clausesError;
    }

    // STEP 5 — EXTRACT OBLIGATIONS
    const obligations = extractObligations(clauses);

    // STEP 6 — SAVE OBLIGATIONS
    if (obligations.length > 0) {
      const obligationsToInsert = obligations.map((obligation) => ({
        contract_id: contract.id,
        clause_id: obligation.clause_id || null,
        obligation_text: obligation.obligation_text,
        responsible_party: obligation.responsible_party,
        obligation_type: obligation.obligation_type,
      }));

      const { error: obligationsError } = await supabase
        .from("obligations")
        .insert(obligationsToInsert);

      if (obligationsError) {
        throw obligationsError;
      }
    }

    // CLEAN RESPONSE
    return res.json({
      success: true,
      contractId: contract.id,
      contractName: contract.contract_name,
      clausesDetected: clauses.length,
      obligationsDetected: obligations.length,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

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

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;

    const extractedText = await extractPdfText(file.buffer);

    const fileName = `${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

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
      return res.status(500).json({ error: contractError.message });
    }

    /* =========================
       CLAUSES
    ========================= */

    const clauses = extractClauses(extractedText);

    console.log("🔥 RAW CLAUSES TYPE:", typeof clauses);
    console.log("🔥 RAW CLAUSES:", clauses);
    console.log("🔥 CLAUSES LENGTH:", clauses?.length);

    const clausesToInsert = clauses.map((clause) => ({
      contract_id: contractData.id,
      clause_name: clause.clause_title,
      clause_type: clause.clause_category,
      clause_text: clause.clause_text,
      risk_level: clause.risk_level,
    }));

    const { data: insertedClauses, error: clauseError } =
      await supabase
        .from("contract_clauses")
        .insert(clausesToInsert)
        .select();

    if (clauseError) {
      console.log("❌ CLAUSE INSERT ERROR:", clauseError);
    }

    console.log("✅ INSERTED CLAUSES COUNT:", insertedClauses?.length);

    /* =========================
       OBLIGATIONS (DEBUG)
    ========================= */

    console.log("🔥 PASSING TO OBLIGATIONS:", clauses);

    const obligations = extractObligations(clauses);

    console.log("🔥 RAW OBLIGATIONS OUTPUT:", obligations);
    console.log("🔥 OBLIGATIONS LENGTH:", obligations?.length);

    const { data: insertedObligations, error: obligationError } =
      await supabase
        .from("obligations")
        .insert(obligations)
        .select();

    if (obligationError) {
      console.log("❌ OBLIGATION INSERT ERROR:", obligationError);
    }

    console.log("✅ INSERTED OBLIGATIONS COUNT:", insertedObligations?.length);

    return res.json({
      success: true,
      contract: contractData,
      clausesDetected: insertedClauses?.length || 0,
      obligationsDetected: insertedObligations?.length || 0,
      debug: {
        clausesType: typeof clauses,
        obligationsType: typeof obligations,
      },
    });
  } catch (error) {
    console.error("❌ FATAL ERROR:", error);

    return res.status(500).json({ error: error.message });
  }
});

export default router;

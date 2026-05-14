import { logAudit } from "./db.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ===============================
// SIMPLE AI CONTRACT EXTRACTOR (MVP)
// ===============================
// NOTE: later we replace with real LLM pipeline
// ===============================

export async function extractContract(req, res) {
  try {
    const { contract_id, version_id, text } = req.body;

    if (!contract_id || !text) {
      return res.status(400).json({
        error: "contract_id and text required",
      });
    }

    const companyId = req.user.company_id || null;

    // ===============================
    // MOCK CLAUSE EXTRACTION (replace later with LLM)
    // ===============================

    const clauses = [
      {
        clause_name: "Maintenance Responsibility",
        clause_type: "maintenance",
        clause_text: text.slice(0, 120),
        normalized_value: "operator responsible for base maintenance",
        confidence_score: 0.82,
        risk_level: "medium",
      },
      {
        clause_name: "Return Condition",
        clause_type: "redelivery",
        clause_text: text.slice(120, 240),
        normalized_value: "aircraft must be returned in serviceable condition",
        confidence_score: 0.74,
        risk_level: "high",
      },
    ];

    // ===============================
    // STORE AI EXTRACTION LOG
    // ===============================

    const { data: extractionLog } = await supabase
      .from("ai_extraction_logs")
      .insert([
        {
          contract_id,
          version_id,
          company_id: companyId,
          extraction_type: "contract_parse",
          ai_model: "mock-v1",
          prompt_version: "v1",
          confidence_score:
            clauses.reduce((a, b) => a + b.confidence_score, 0) /
            clauses.length,
          extraction_status: "completed",
          requires_human_review: true,
          extracted_fields: { clauses },
        },
      ])
      .select()
      .single();

    // ===============================
    // STORE CLAUSES
    // ===============================

    for (const clause of clauses) {
      await supabase.from("contract_clauses").insert([
        {
          contract_id,
          version_id,
          company_id: companyId,
          clause_name: clause.clause_name,
          clause_type: clause.clause_type,
          clause_text: clause.clause_text,
          normalized_value: clause.normalized_value,
          ai_extracted: true,
          confidence_score: clause.confidence_score,
          risk_level: clause.risk_level,
        },
      ]);
    }

    // ===============================
    // AUDIT LOG
    // ===============================

    await logAudit({
      user_id: req.user.id,
      company_id: companyId,
      action: "CONTRACT_AI_EXTRACTED",
      entity_type: "contract",
      entity_id: contract_id,
      metadata: {
        version_id,
        clauses_extracted: clauses.length,
      },
    });

    res.json({
      success: true,
      extraction_id: extractionLog.id,
      clauses,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "AI extraction failed",
    });
  }
}

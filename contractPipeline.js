import pdf from "pdf-parse";
import { logAudit } from "./db.js";
import { analyzeContract } from "./aiEngine.js";
import { reasonClauses } from "./clauseReasoningEngine.js";

/* ===============================
   PDF TEXT EXTRACTION
=============================== */

async function extractText(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (err) {
    console.error("PDF extraction failed:", err.message);
    throw new Error("Failed to extract PDF text");
  }
}

/* ===============================
   MAIN PIPELINE
=============================== */

export async function processContractPipeline({
  supabase,
  fileBuffer,
  file_id,
  file_name,
  user,
  company_id
}) {
  try {

    /* ===============================
       1. EXTRACT TEXT
    =============================== */

    const extractedText = await extractText(fileBuffer);

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Contract text too short or empty");
    }

    /* ===============================
       2. AI ANALYSIS (BASE MODEL)
    =============================== */

    const aiResult = await analyzeContract(extractedText);

    if (!aiResult || !aiResult.clauses) {
      throw new Error("AI analysis failed");
    }

    /* ===============================
       3. CLAUSE REASONING LAYER (NEW)
    =============================== */

    const clausesWithReasoning = await reasonClauses(aiResult.clauses);

    aiResult.clauses = clausesWithReasoning;

    /* ===============================
       4. STORE CONTRACT FILE
    =============================== */

    await supabase.from("contract_files").upsert({
      id: file_id,
      company_id,
      file_name,
      extracted_text: extractedText,
      created_at: new Date()
    });

    /* ===============================
       5. STORE CONTRACT VERSION
    =============================== */

    const { data: version, error: versionError } =
      await supabase
        .from("contract_versions")
        .insert([
          {
            contract_id: file_id,
            company_id,
            summary: aiResult.summary,
            overall_risk: aiResult.overall_risk,
            clauses: aiResult.clauses,
            created_by: user.id,
            created_at: new Date()
          }
        ])
        .select()
        .single();

    if (versionError) {
      console.error("Version insert failed:", versionError.message);
    }

    /* ===============================
       6. AUDIT LOG
    =============================== */

    await logAudit({
      user_id: user.id,
      company_id,
      action: "CONTRACT_PROCESSED",
      entity_type: "contract",
      entity_id: file_id,
      metadata: {
        file_name,
        overall_risk: aiResult.overall_risk,
        clause_count: aiResult.clauses.length
      }
    });

    /* ===============================
       RESULT
    =============================== */

    return {
      success: true,
      file_id,
      file_name,
      ai: aiResult,
      version_id: version?.id || null
    };

  } catch (err) {
    console.error("Contract pipeline error:", err.message);
    throw new Error("Contract processing pipeline failed: " + err.message);
  }
}

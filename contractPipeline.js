import pdf from "pdf-parse";
import { logAudit } from "./db.js";
import { createContractVersion } from "./contractVersionEngine.js";

/* ===============================
   PDF TEXT EXTRACTION
=============================== */

async function extractText(buffer) {
  const data = await pdf(buffer);
  return data.text;
}

/* ===============================
   SIMPLE AI ENGINE (HYBRID READY)
   (MISTRAL / OPENAI SWITCH LAYER)
=============================== */

async function runAIExtraction(text) {
  // For now: deterministic structured mock
  // Next step: plug Mistral/OpenAI here

  const clauses = text
    .split("\n")
    .filter(line => line.length > 30)
    .slice(0, 15)
    .map((c, i) => ({
      id: i + 1,
      text: c,
      risk: Math.random() * 100
    }));

  const avgRisk =
    clauses.reduce((s, c) => s + c.risk, 0) /
    (clauses.length || 1);

  return {
    clauses,
    risk_score: Math.round(avgRisk),
    summary: "Auto-extracted contract analysis (v1)"
  };
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

    /* ===============================
       2. AI ANALYSIS
    =============================== */

    const aiResult = await runAIExtraction(extractedText);

    /* ===============================
       3. STORE FILE METADATA
    =============================== */

    await supabase.from("contract_files").upsert({
      id: file_id,
      company_id,
      file_name,
      extracted_text: extractedText
    });

    /* ===============================
       4. CREATE VERSION
    =============================== */

    const version = await createContractVersion({
      supabase,
      file_id,
      company_id,
      clauses: aiResult.clauses,
      risk_score: aiResult.risk_score,
      user_id: user.id
    });

    /* ===============================
       5. AUDIT LOG
    =============================== */

    await logAudit({
      user_id: user.id,
      company_id,
      action: "CONTRACT_PROCESSED",
      entity_type: "contract",
      entity_id: file_id,
      metadata: {
        risk_score: aiResult.risk_score,
        clauses: aiResult.clauses.length
      }
    });

    /* ===============================
       RESULT
    =============================== */

    return {
      success: true,
      ai: aiResult,
      version
    };

  } catch (err) {
    console.error("Pipeline error:", err);
    throw new Error("Contract pipeline failed");
  }
}

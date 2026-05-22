import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ======================================================
// SAFE CONTRACT SAVER (SCHEMA ALIGNED)
// ======================================================

export async function saveContractToDB(extraction) {
  try {
    const contractData = extraction.contract || extraction;

    const filename =
      contractData.filename ||
      contractData.source_file ||
      "unknown.pdf";

    const extractedText =
      contractData.contract?.extracted_text ||
      contractData.extracted_text ||
      "";

    const clauses = contractData.clauses || [];
    const obligations = contractData.obligations || [];

    const clausesDetected = clauses.length;
    const obligationsDetected = obligations.length;

    // ======================================================
    // INSERT CONTRACT (FULL SCHEMA SAFE)
    // ======================================================
    const { data: contractRow, error: contractError } = await supabase
      .from("contracts")
      .insert({
        filename,
        source_file: filename,
        contract_name: filename,
        name: filename,

        contract_type: "uploaded",

        extracted_text: extractedText,

        clauses_detected: clausesDetected,
        obligations_detected: obligationsDetected,

        created_at: new Date().toISOString(),
        updates_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (contractError) {
      console.error("❌ CONTRACT INSERT ERROR:", contractError);
      throw contractError;
    }

    const contractId = contractRow.id;

    // ======================================================
    // CLAUSES (ONLY IF YOU HAVE CLAUSE TABLE)
    // ======================================================
    if (clauses.length > 0) {
      const clauseRows = clauses.map((c, index) => ({
        contract_id: contractId,
        clause_number: c.clause_number || index + 1,
        clause_title: c.clause_title || null,
        clause_text: c.clause_text || "",
        clause_type: c.clause_type || "general",
      }));

      const { error: clauseError } = await supabase
        .from("clauses")
        .insert(clauseRows);

      if (clauseError) {
        console.error("❌ CLAUSES INSERT ERROR:", clauseError);
        throw clauseError;
      }
    }

    // ======================================================
    // OBLIGATIONS
    // ======================================================
    if (obligations.length > 0) {
      const obligationRows = obligations.map((o) => ({
        contract_id: contractId,
        clause_id: o.clause_id || null,
        obligation_text: o.obligation_text || "",
        responsible_party: o.responsible_party || "unknown",
        obligation_type: o.obligation_type || "general",
      }));

      const { error: obligationError } = await supabase
        .from("obligations")
        .insert(obligationRows);

      if (obligationError) {
        console.error("❌ OBLIGATIONS INSERT ERROR:", obligationError);
        throw obligationError;
      }
    }

    return {
      success: true,
      contract_id: contractId,
      clauses_saved: clausesDetected,
      obligations_saved: obligationsDetected,
    };
  } catch (err) {
    console.error("🔥 SAVE CONTRACT FAILED:", err);

    return {
      success: false,
      error: err.message,
    };
  }
}

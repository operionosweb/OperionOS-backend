import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Saves extracted contract + clauses + obligations into Supabase
 */
export async function saveContractToDB(extraction) {
  try {
    const contractData = extraction.contract || extraction;

    const filename = contractData.filename || "unknown.pdf";

    const extractedText =
      contractData.contract?.extracted_text ||
      contractData.extracted_text ||
      "";

    const clauses = contractData.clauses || [];
    const obligations = contractData.obligations || [];

    const clausesDetected = clauses.length;
    const obligationsDetected = obligations.length;

    // =========================
    // 1. INSERT CONTRACT
    // =========================
    const { data: contractRow, error: contractError } = await supabase
      .from("contracts")
      .insert({
        filename,
        extracted_text: extractedText
      })
      .select()
      .single();

    if (contractError) {
      console.error("❌ CONTRACT INSERT ERROR:", contractError);
      throw contractError;
    }

    const contractId = contractRow.id;

    // =========================
    // 2. INSERT CLAUSES
    // =========================
    if (clauses.length > 0) {
      const clauseRows = clauses.map((c) => ({
        contract_id: contractId,
        clause_number: c.clause_number,
        clause_title: c.clause_title,
        clause_text: c.clause_text,
        clause_type: c.clause_type
      }));

      const { error: clauseError } = await supabase
        .from("clauses")
        .insert(clauseRows);

      if (clauseError) {
        console.error("❌ CLAUSES INSERT ERROR:", clauseError);
        throw clauseError;
      }
    }

    // =========================
    // 3. INSERT OBLIGATIONS
    // =========================
    if (obligations.length > 0) {
      const obligationRows = obligations.map((o) => ({
        contract_id: contractId,
        clause_id: o.clause_id,
        obligation_text: o.obligation_text,
        responsible_party: o.responsible_party,
        obligation_type: o.obligation_type
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
      obligations_saved: obligationsDetected
    };
  } catch (err) {
    console.error("🔥 SAVE CONTRACT FAILED:", err);

    return {
      success: false,
      error: err.message
    };
  }
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveContractData(data) {
  // SAVE CONTRACT
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert([
      {
        filename: data.filename,
        extracted_text: data.contract.extracted_text,
        contract_type: "Aircraft Lease Agreement",
        clauses_detected: data.clauses.length,
        obligations_detected: data.obligations.length
      }
    ])
    .select()
    .single();

  if (contractError) {
    throw contractError;
  }

  const contractId = contract.id;

  // SAVE CLAUSES
  const clausesToInsert = data.clauses.map((clause) => ({
    contract_id: contractId,
    clause_number: clause.clause_number,
    clause_title: clause.clause_title,
    clause_text: clause.clause_text,
    clause_type: clause.clause_type
  }));

  const { data: insertedClauses, error: clauseError } = await supabase
    .from("clauses")
    .insert(clausesToInsert)
    .select();

  if (clauseError) {
    throw clauseError;
  }

  // SAVE OBLIGATIONS
  const obligationsToInsert = data.obligations.map((obligation) => ({
    contract_id: contractId,
    clause_id: obligation.clause_id,
    responsible_party: obligation.responsible_party,
    obligation_text: obligation.obligation_text,
    obligation_type: obligation.obligation_type
  }));

  const { error: obligationError } = await supabase
    .from("obligations")
    .insert(obligationsToInsert);

  if (obligationError) {
    throw obligationError;
  }

  return {
    success: true,
    contract_id: contractId,
    clauses_saved: insertedClauses.length,
    obligations_saved: obligationsToInsert.length
  };
}

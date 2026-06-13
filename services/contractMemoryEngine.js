import supabase from "../supabaseClient.js";

/**
 * =========================================
 * CONTRACT MEMORY ENGINE
 * =========================================
 * Stores + retrieves past AI decisions to improve future reasoning
 */

export async function storeContractMemory({
  contract_id,
  company_id,
  clauses,
  decision_chain,
  risk_level,
}) {
  try {
    const { data, error } = await supabase
      .from("contract_memory")
      .insert([
        {
          contract_id,
          company_id,
          clauses,
          decision_chain,
          risk_level,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      memory_id: data.id,
    };
  } catch (err) {
    console.error("❌ MEMORY STORE ERROR:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * =========================================
 * FETCH SIMILAR CONTRACT HISTORY
 * =========================================
 */

export async function fetchContractMemory({ company_id }) {
  try {
    const { data, error } = await supabase
      .from("contract_memory")
      .select("*")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return {
      success: true,
      memories: data,
    };
  } catch (err) {
    console.error("❌ MEMORY FETCH ERROR:", err.message);

    return {
      success: false,
      memories: [],
    };
  }
}
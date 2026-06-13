import supabase from "../supabaseClient.js";

/**
 * PERSIST AUDIT TRAILS (AIRLINE COMPLIANCE READY)
 */

export async function storeAudit(audit) {
  try {
    const { data, error } = await supabase
      .from("contract_audit_log")
      .insert([audit]);

    if (error) {
      console.error("❌ AUDIT STORE ERROR:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("❌ AUDIT SYSTEM FAILURE:", err.message);
    return null;
  }
}
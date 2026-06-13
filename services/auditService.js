import supabase from "../supabaseClient.js";

/**
 * =========================================
 * TENANT-AWARE AUDIT LOGGING
 * =========================================
 */

export async function logAudit({
  tenant,
  action,
  entity_type,
  entity_id,
  metadata = {},
}) {
  try {
    const { error } = await supabase.from("contract_audit_log").insert([
      {
        org_id: tenant?.org_id,
        airline_id: tenant?.airline_id,
        request_id: tenant?.request_id,
        action,
        entity_type,
        entity_id,
        metadata,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error("❌ AUDIT ERROR:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}
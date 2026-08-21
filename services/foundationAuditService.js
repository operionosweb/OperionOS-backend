import supabase from "../config/supabase.js";

export async function recordAuditEvent({
  organizationId = null,
  actorId = null,
  requestId = null,
  action,
  entityType,
  entityId = null,
  metadata = {},
}) {
  if (!action || !entityType) {
    throw new TypeError("action and entityType are required");
  }

  const { data, error } = await supabase
    .from("audit_events")
    .insert({
      organization_id: organizationId,
      actor_id: actorId,
      request_id: requestId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

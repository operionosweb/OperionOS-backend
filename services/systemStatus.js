export function getDeclaredSystemStatus(now = () => new Date().toISOString()) {
  return {
    success: true,
    services: {
      api: "healthy",
      copilot: "enabled",
      operion: "enabled",
      dashboard: "enabled",
      tenant_system: "enabled",
      horizon_sync: "enabled",
      audit_layer: "enabled",
    },
    timestamp: now(),
  };
}

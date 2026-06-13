export function logEvent(type, payload = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    ...payload,
  };

  console.log("📡 OPERION_LOG:", JSON.stringify(log));
}
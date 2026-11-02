import { mattLiveConfiguration } from "./mattLiveService.js";
import { MATT_DEMO_ORGANIZATION_ID } from "./mattDemoContext.js";

export function mattDemoConfiguration(env = process.env) {
  const bounded = (name, maximum) => /^\d+$/.test(env[name] || "") && Number(env[name]) >= 1 && Number(env[name]) <= maximum;
  const origins = (env.MATT_DEMO_ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  const validOrigins = origins.length > 0 && origins.every((origin) => {
    try {
      const url = new URL(origin);
      return url.origin === origin && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
    } catch { return false; }
  });
  const missing = [
    ...mattLiveConfiguration(env).missing,
    ...[
      ["MATT_DEMO_APPROVAL_ID", Boolean(env.MATT_DEMO_APPROVAL_ID?.trim())],
      ["MATT_DEMO_SINGLE_PROCESS_APPROVED", env.MATT_DEMO_SINGLE_PROCESS_APPROVED === "true"],
      ["MATT_DEMO_ALLOWED_ORIGINS", validOrigins],
      ["MATT_DEMO_MAX_SESSIONS", bounded("MATT_DEMO_MAX_SESSIONS", 12)],
      ["MATT_DEMO_INTELLIGENCE_BUDGET", bounded("MATT_DEMO_INTELLIGENCE_BUDGET", 3000)],
      ["MATT_DEMO_ORGANIZATION_ALLOWLIST", (env.MATT_LIVE_ORGANIZATIONS || "").split(",").map((id) => id.trim()).includes(MATT_DEMO_ORGANIZATION_ID)],
    ].filter(([, ready]) => !ready).map(([name]) => name),
  ];
  return {
    allowed: true, enabled: missing.length === 0, missing,
    readiness: missing.length ? "configuration_incomplete" : "configured",
    origins: validOrigins ? origins : [],
    maxSessions: bounded("MATT_DEMO_MAX_SESSIONS", 12) ? Number(env.MATT_DEMO_MAX_SESSIONS) : 0,
    intelligenceBudget: bounded("MATT_DEMO_INTELLIGENCE_BUDGET", 3000) ? Number(env.MATT_DEMO_INTELLIGENCE_BUDGET) : 0,
  };
}

// services/aiTelemetry.js

/**
 * =========================================
 * EU-FIRST AI TELEMETRY + OBSERVABILITY LAYER
 * =========================================
 *
 * Tracks:
 * - provider latency
 * - success/failure rates
 * - basic cost estimation (optional)
 * - safe EU audit logging
 */

import fs from "fs";

/**
 * -----------------------------------------
 * IN-MEMORY METRICS STORE
 * (safe for single-instance Render deploy)
 * -----------------------------------------
 */

const metrics = {
  requests: 0,
  success: 0,
  failures: 0,

  providers: {
    mistral: { calls: 0, failures: 0, totalLatency: 0 },
    aleph_alpha: { calls: 0, failures: 0, totalLatency: 0 },
    openai: { calls: 0, failures: 0, totalLatency: 0 },
    fallback: { calls: 0 },
  },
};

/**
 * -----------------------------------------
 * START TIMER
 * -----------------------------------------
 */

export function startTimer() {
  return Date.now();
}

/**
 * -----------------------------------------
 * END TIMER + LOG PROVIDER STATS
 * -----------------------------------------
 */

export function endTimer(provider, startTime, success = true) {
  const duration = Date.now() - startTime;

  metrics.requests++;

  if (success) {
    metrics.success++;
  } else {
    metrics.failures++;
  }

  if (metrics.providers[provider]) {
    metrics.providers[provider].calls++;

    if (metrics.providers[provider].totalLatency !== undefined) {
      metrics.providers[provider].totalLatency += duration;
    }

    if (!success && metrics.providers[provider].failures !== undefined) {
      metrics.providers[provider].failures++;
    }
  }

  return duration;
}

/**
 * -----------------------------------------
 * OPTIONAL COST ESTIMATION (LIGHTWEIGHT)
 * -----------------------------------------
 */

export function estimateCost(provider, tokensApprox = 1000) {
  const rates = {
    mistral: 0.002,
    aleph_alpha: 0.003,
    openai: 0.005,
    fallback: 0,
  };

  const rate = rates[provider] || 0;

  return +(rate * (tokensApprox / 1000)).toFixed(6);
}

/**
 * -----------------------------------------
 * SAFE AUDIT LOGGER (EU GDPR SAFE)
 * -----------------------------------------
 * NO PERSONAL DATA, ONLY METADATA
 * -----------------------------------------
 */

export function auditLog(event) {
  const safeEvent = {
    timestamp: new Date().toISOString(),
    event_type: event?.event_type || "unknown",
    provider: event?.provider || "unknown",
    duration_ms: event?.duration_ms || 0,
    success: !!event?.success,
    region: "EU",
  };

  // optional file logging (safe for Render ephemeral disk)
  try {
    fs.appendFileSync(
      "./ai-audit.log",
      JSON.stringify(safeEvent) + "\n"
    );
  } catch (err) {
    console.warn("Audit log write failed:", err.message);
  }

  return safeEvent;
}

/**
 * -----------------------------------------
 * METRICS SNAPSHOT (FOR DEBUG / ADMIN)
 * -----------------------------------------
 */

export function getMetrics() {
  return {
    ...metrics,
    avg_latency: {
      mistral:
        metrics.providers.mistral.calls > 0
          ? metrics.providers.mistral.totalLatency /
            metrics.providers.mistral.calls
          : 0,

      aleph_alpha:
        metrics.providers.aleph_alpha.calls > 0
          ? metrics.providers.aleph_alpha.totalLatency /
            metrics.providers.aleph_alpha.calls
          : 0,

      openai:
        metrics.providers.openai.calls > 0
          ? metrics.providers.openai.totalLatency /
            metrics.providers.openai.calls
          : 0,
    },
  };
}

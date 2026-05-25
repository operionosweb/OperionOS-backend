// services/aiProviderHealth.js

/**
 * =========================================
 * OPERION OS - AI PROVIDER HEALTH SYSTEM
 * STARTUP + RUNTIME PROVIDER MONITORING
 * =========================================
 */

import axios from "axios";
import OpenAI from "openai";

/**
 * -----------------------------------------
 * PROVIDER REGISTRY (LIVE STATE)
 * -----------------------------------------
 */

export const providerState = {
  mistral: { status: "unknown", latency: null },
  aleph_alpha: { status: "unknown", latency: null },
  openai: { status: "unknown", latency: null },
};

/**
 * -----------------------------------------
 * OPENAI CLIENT (health check only)
 * -----------------------------------------
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * HEALTH CHECK WRAPPER
 * -----------------------------------------
 */

async function measure(fn) {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return { ok: false, latency: Date.now() - start, error: err.message };
  }
}

/**
 * -----------------------------------------
 * MISTRAL HEALTH CHECK
 * -----------------------------------------
 */

async function checkMistral() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    providerState.mistral.status = "missing_key";
    return;
  }

  const result = await measure(async () => {
    await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small-latest",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
  });

  providerState.mistral = {
    status: result.ok ? "healthy" : "offline",
    latency: result.latency,
  };
}

/**
 * -----------------------------------------
 * ALEPH ALPHA HEALTH CHECK
 * -----------------------------------------
 */

async function checkAlephAlpha() {
  const apiKey = process.env.ALEPH_ALPHA_API_KEY;
  if (!apiKey) {
    providerState.aleph_alpha.status = "missing_key";
    return;
  }

  const result = await measure(async () => {
    await axios.post(
      "https://api.aleph-alpha.com/complete",
      {
        model: "luminous-base",
        prompt: "ping",
        maximum_tokens: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
  });

  providerState.aleph_alpha = {
    status: result.ok ? "healthy" : "offline",
    latency: result.latency,
  };
}

/**
 * -----------------------------------------
 * OPENAI HEALTH CHECK
 * -----------------------------------------
 */

async function checkOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    providerState.openai.status = "missing_key";
    return;
  }

  const result = await measure(async () => {
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
    });
  });

  providerState.openai = {
    status: result.ok ? "healthy" : "offline",
    latency: result.latency,
  };
}

/**
 * -----------------------------------------
 * RUN ALL HEALTH CHECKS
 * -----------------------------------------
 */

export async function runProviderHealthCheck() {
  console.log("🧠 Running AI provider health checks...");

  await Promise.allSettled([
    checkMistral(),
    checkAlephAlpha(),
    checkOpenAI(),
  ]);

  console.log("📊 AI Provider Status:");
  console.log(JSON.stringify(providerState, null, 2));

  return providerState;
}

/**
 * -----------------------------------------
 * GET BEST AVAILABLE PROVIDERS (FOR ROUTER)
 * -----------------------------------------
 */

export function getHealthyProviders() {
  return Object.entries(providerState)
    .filter(([, value]) => value.status === "healthy")
    .sort((a, b) => (a[1].latency || 9999) - (b[1].latency || 9999))
    .map(([key]) => key);
}

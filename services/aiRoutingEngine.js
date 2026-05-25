// services/aiRoutingEngine.js

/**
 * =========================================
 * OPERION OS - AI ROUTING ENGINE
 * EU-FIRST MULTI-MODEL ORCHESTRATION LAYER
 * =========================================
 */

import { analyzeWithProviders } from "./aiProviders.js";

/**
 * -----------------------------------------
 * CONFIGURATION (EU-FIRST PRIORITY ORDER)
 * -----------------------------------------
 */

const AI_PROVIDERS_PRIORITY = [
  "mistral",
  "aleph_alpha",
  "openai",
];

/**
 * -----------------------------------------
 * TIMEOUT CONTROL (production safety)
 * -----------------------------------------
 */

const TIMEOUT_MS = 25000;

/**
 * -----------------------------------------
 * SAFE FALLBACK RESPONSE (guaranteed structure)
 * -----------------------------------------
 */

function safeFallbackResponse() {
  return {
    provider: "fallback",
    analysis: {
      contract_type: "General Contract",
      supplier_name: "Unknown",
      summary:
        "AI analysis unavailable. System returned safe fallback response.",
      risk_score: 0,
      contract_value: 0,
      clauses: [],
      obligations: [],
    },
  };
}

/**
 * -----------------------------------------
 * TIMEOUT WRAPPER
 * -----------------------------------------
 */

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), timeoutMs)
    ),
  ]);
}

/**
 * -----------------------------------------
 * CORE ROUTING LOGIC
 * -----------------------------------------
 */

export async function routeAIAnalysis(text = "") {
  if (!text) {
    return {
      success: false,
      error: "No input text provided",
    };
  }

  let lastError = null;

  /**
   * -----------------------------------------
   * EU-FIRST PROVIDER LOOP
   * -----------------------------------------
   */

  for (const provider of AI_PROVIDERS_PRIORITY) {
    try {
      console.log(`🧠 AI Router → Trying provider: ${provider}`);

      const result = await withTimeout(
        analyzeWithProviders(text, provider),
        TIMEOUT_MS
      );

      if (result?.analysis) {
        return {
          success: true,
          provider_used: provider,
          fallback_used: false,
          analysis: result.analysis,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Provider failed: ${provider}`, error.message);
      lastError = error;
      continue;
    }
  }

  /**
   * -----------------------------------------
   * FINAL FALLBACK (GUARANTEED RESPONSE)
   * -----------------------------------------
   */

  console.error("❌ All AI providers failed. Using fallback.");

  return {
    success: true,
    provider_used: "fallback",
    fallback_used: true,
    error: lastError?.message || "All providers failed",
    ...safeFallbackResponse(),
  };
}

/**
 * -----------------------------------------
 * LIGHTWEIGHT SINGLE-PROVIDER CALL
 * (optional direct access)
 * -----------------------------------------
 */

export async function routeSingleProvider(text, provider) {
  try {
    const result = await withTimeout(
      analyzeWithProviders(text, provider),
      TIMEOUT_MS
    );

    return {
      success: true,
      provider_used: provider,
      analysis: result?.analysis || null,
    };
  } catch (error) {
    return {
      success: false,
      provider_used: provider,
      error: error.message,
    };
  }
}

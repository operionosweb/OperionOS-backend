// services/aiProviders.js

import axios from "axios";
import {
  startTimer,
  endTimer,
  estimateCost,
  auditLog,
} from "./aiTelemetry.js";

/**
 * =========================================
 * EU-FIRST AI ROUTING ENGINE (PRODUCTION + TELEMETRY)
 * Mistral → Aleph Alpha → OpenAI → Fallback
 * =========================================
 */

const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const ALEPH_KEY = process.env.ALEPH_ALPHA_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * -----------------------------------------
 * TIMEOUT WRAPPER
 * -----------------------------------------
 */

function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
}

/**
 * -----------------------------------------
 * SAFE JSON PARSER
 * -----------------------------------------
 */

function safeParseJSON(text) {
  try {
    if (!text) return {};
    if (typeof text === "object") return text;

    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * =========================================
 * 1. MISTRAL (EU PRIMARY)
 * =========================================
 */

async function callMistral(text) {
  const start = startTimer();

  try {
    if (!MISTRAL_KEY) throw new Error("Missing Mistral key");

    const response = await withTimeout(
      axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-large-latest",
          messages: [
            {
              role: "system",
              content: "Return ONLY valid JSON for contract analysis.",
            },
            {
              role: "user",
              content: text,
            },
          ],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${MISTRAL_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
    );

    const content =
      response?.data?.choices?.[0]?.message?.content || "{}";

    const analysis = safeParseJSON(content);

    const duration = endTimer("mistral", start, true);

    auditLog({
      event_type: "ai_request",
      provider: "mistral",
      success: true,
      duration_ms: duration,
    });

    return {
      provider: "mistral",
      analysis,
      cost: estimateCost("mistral"),
    };
  } catch (err) {
    const duration = endTimer("mistral", start, false);

    auditLog({
      event_type: "ai_request",
      provider: "mistral",
      success: false,
      duration_ms: duration,
    });

    throw err;
  }
}

/**
 * =========================================
 * 2. ALEPH ALPHA (EU FALLBACK)
 * =========================================
 */

async function callAlephAlpha(text) {
  const start = startTimer();

  try {
    if (!ALEPH_KEY) throw new Error("Missing Aleph Alpha key");

    const response = await withTimeout(
      axios.post(
        "https://api.aleph-alpha.com/complete",
        {
          model: "luminous-base",
          prompt: `
Return ONLY JSON:

${text}

{
  "contract_type": "",
  "supplier_name": "",
  "summary": "",
  "risk_score": 0,
  "clauses": [],
  "obligations": []
}
          `,
          maximum_tokens: 800,
        },
        {
          headers: {
            Authorization: `Bearer ${ALEPH_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
    );

    const analysis = safeParseJSON(response?.data?.completion);

    const duration = endTimer("aleph_alpha", start, true);

    auditLog({
      event_type: "ai_request",
      provider: "aleph_alpha",
      success: true,
      duration_ms: duration,
    });

    return {
      provider: "aleph_alpha",
      analysis,
      cost: estimateCost("aleph_alpha"),
    };
  } catch (err) {
    const duration = endTimer("aleph_alpha", start, false);

    auditLog({
      event_type: "ai_request",
      provider: "aleph_alpha",
      success: false,
      duration_ms: duration,
    });

    throw err;
  }
}

/**
 * =========================================
 * 3. OPENAI (GLOBAL FALLBACK)
 * =========================================
 */

async function callOpenAI(text) {
  const start = startTimer();

  try {
    if (!OPENAI_KEY) throw new Error("Missing OpenAI key");

    const response = await withTimeout(
      axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Return ONLY valid JSON contract analysis.",
            },
            {
              role: "user",
              content: text,
            },
          ],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
        }
      )
    );

    const content =
      response?.data?.choices?.[0]?.message?.content || "{}";

    const analysis = safeParseJSON(content);

    const duration = endTimer("openai", start, true);

    auditLog({
      event_type: "ai_request",
      provider: "openai",
      success: true,
      duration_ms: duration,
    });

    return {
      provider: "openai",
      analysis,
      cost: estimateCost("openai"),
    };
  } catch (err) {
    const duration = endTimer("openai", start, false);

    auditLog({
      event_type: "ai_request",
      provider: "openai",
      success: false,
      duration_ms: duration,
    });

    throw err;
  }
}

/**
 * =========================================
 * 4. SAFE FALLBACK
 * =========================================
 */

function fallback() {
  return {
    provider: "fallback",
    analysis: {
      contract_type: "General Contract",
      supplier_name: "Unknown",
      summary: "AI unavailable - fallback activated.",
      risk_score: 0,
      contract_value: 0,
      clauses: [],
      obligations: [],
    },
    cost: 0,
  };
}

/**
 * =========================================
 * MAIN EU-FIRST ROUTER
 * =========================================
 */

export async function analyzeWithProviders(text) {
  /**
   * STEP 1 — MISTRAL (EU PRIMARY)
   */
  try {
    const res = await callMistral(text);
    if (res?.analysis && Object.keys(res.analysis).length > 0) {
      return res;
    }
  } catch (e) {
    console.warn("Mistral failed:", e.message);
  }

  /**
   * STEP 2 — ALEPH ALPHA (EU FALLBACK)
   */
  try {
    const res = await callAlephAlpha(text);
    if (res?.analysis && Object.keys(res.analysis).length > 0) {
      return res;
    }
  } catch (e) {
    console.warn("Aleph Alpha failed:", e.message);
  }

  /**
   * STEP 3 — OPENAI (GLOBAL FALLBACK)
   */
  try {
    const res = await callOpenAI(text);
    if (res?.analysis && Object.keys(res.analysis).length > 0) {
      return res;
    }
  } catch (e) {
    console.warn("OpenAI failed:", e.message);
  }

  /**
   * STEP 4 — SAFE FALLBACK
   */
  return fallback();
}

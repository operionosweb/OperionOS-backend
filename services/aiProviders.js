// services/aiProviders.js

/**
 * =========================================
 * OPERION OS - AI PROVIDERS LAYER
 * EU-FIRST MULTI-MODEL ABSTRACTION
 * =========================================
 */

import OpenAI from "openai";
import axios from "axios";

/**
 * -----------------------------------------
 * ENV SETUP
 * -----------------------------------------
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * SAFE NORMALIZED OUTPUT FORMAT
 * -----------------------------------------
 */

function normalizeOutput(provider, raw) {
  try {
    return {
      provider,
      analysis: {
        contract_type:
          raw?.contract_type || raw?.type || "General Contract",

        supplier_name:
          raw?.supplier_name || raw?.vendor || "Unknown",

        summary:
          raw?.summary ||
          raw?.message ||
          "AI analysis completed via EU-first routing layer.",

        risk_score: raw?.risk_score ?? 0,

        contract_value: raw?.contract_value ?? 0,

        clauses: Array.isArray(raw?.clauses)
          ? raw.clauses
          : [],

        obligations: Array.isArray(raw?.obligations)
          ? raw.obligations
          : [],
      },
    };
  } catch (e) {
    return {
      provider,
      analysis: {
        contract_type: "General Contract",
        supplier_name: "Unknown",
        summary: "Normalization failed",
        risk_score: 0,
        contract_value: 0,
        clauses: [],
        obligations: [],
      },
    };
  }
}

/**
 * -----------------------------------------
 * MISTRAL (EU PRIMARY)
 * -----------------------------------------
 * NOTE: requires MISTRAL_API_KEY
 * -----------------------------------------
 */

async function callMistral(text) {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY missing");
  }

  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a contract analysis engine. Return structured JSON only.",
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
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  const content = response?.data?.choices?.[0]?.message?.content;

  return normalizeOutput("mistral", safeJsonParse(content));
}

/**
 * -----------------------------------------
 * ALEPH ALPHA (EU SOVEREIGN LAYER)
 * -----------------------------------------
 * NOTE: API format may vary depending on plan
 * -----------------------------------------
 */

async function callAlephAlpha(text) {
  if (!process.env.ALEPH_ALPHA_API_KEY) {
    throw new Error("ALEPH_ALPHA_API_KEY missing");
  }

  const response = await axios.post(
    "https://api.aleph-alpha.com/complete",
    {
      model: "luminous-base",
      prompt: `
Analyze this contract and return structured JSON:
${text}
      `,
      maximum_tokens: 800,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ALEPH_ALPHA_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );

  const textResult = response?.data?.completions?.[0]?.completion;

  return normalizeOutput("aleph_alpha", safeJsonParse(textResult));
}

/**
 * -----------------------------------------
 * OPENAI FALLBACK (GLOBAL)
 * -----------------------------------------
 */

async function callOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Return ONLY valid JSON with contract_type, supplier_name, summary, risk_score, contract_value, clauses, obligations.",
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.2,
  });

  const content = response?.choices?.[0]?.message?.content;

  return normalizeOutput("openai", safeJsonParse(content));
}

/**
 * -----------------------------------------
 * SAFE JSON PARSER (critical for LLM safety)
 * -----------------------------------------
 */

function safeJsonParse(str) {
  try {
    if (!str) return {};

    // remove markdown fences if present
    const cleaned = str
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (e) {
    return {
      summary: str?.slice?.(0, 500) || "Parse failure",
    };
  }
}

/**
 * -----------------------------------------
 * MAIN ROUTER ENTRY (USED BY aiRoutingEngine)
 * -----------------------------------------
 */

export async function analyzeWithProviders(text, providerHint = null) {
  try {
    /**
     * -----------------------------------------
     * IF ROUTER SPECIFIES PROVIDER DIRECTLY
     * -----------------------------------------
     */

    if (providerHint === "mistral") {
      return await callMistral(text);
    }

    if (providerHint === "aleph_alpha") {
      return await callAlephAlpha(text);
    }

    if (providerHint === "openai") {
      return await callOpenAI(text);
    }

    /**
     * -----------------------------------------
     * DEFAULT (DIRECT FALLBACK CHAIN)
     * -----------------------------------------
     */

    try {
      return await callMistral(text);
    } catch (e1) {
      console.warn("Mistral failed:", e1.message);

      try {
        return await callAlephAlpha(text);
      } catch (e2) {
        console.warn("Aleph Alpha failed:", e2.message);

        return await callOpenAI(text);
      }
    }
  } catch (error) {
    console.error("AI Providers Fatal Error:", error);

    return {
      provider: "error",
      analysis: {
        contract_type: "General Contract",
        supplier_name: "Unknown",
        summary: "All AI providers failed",
        risk_score: 0,
        contract_value: 0,
        clauses: [],
        obligations: [],
      },
    };
  }
}

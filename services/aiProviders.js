// services/aiProviders.js

import axios from "axios";

/**
 * =========================================
 * EU-FIRST AI ROUTING ENGINE
 * Mistral → Aleph Alpha → OpenAI → Fallback
 * =========================================
 */

/**
 * -----------------------------------------
 * ENV SAFETY CHECKS
 * -----------------------------------------
 */

const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const ALEPH_KEY = process.env.ALEPH_ALPHA_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

/**
 * -----------------------------------------
 * SIMPLE TIMEOUT WRAPPER
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
 * SAFE JSON PARSER (AI RESILIENCE)
 * -----------------------------------------
 */

function safeParseJSON(text) {
  try {
    if (typeof text === "object") return text;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * =========================================
 * 1. MISTRAL (EU PRIORITY #1)
 * =========================================
 */

async function callMistral(text) {
  if (!MISTRAL_KEY) {
    throw new Error("Mistral key missing");
  }

  const response = await withTimeout(
    axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content:
              "You are a contract analysis engine. Return STRICT JSON only.",
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

  const content = response?.data?.choices?.[0]?.message?.content;

  return {
    provider: "mistral",
    analysis: safeParseJSON(content) || {},
  };
}

/**
 * =========================================
 * 2. ALEPH ALPHA (EU #2)
 * NOTE: KEY MAY NOT EXIST YET → SAFE HANDLING
 * =========================================
 */

async function callAlephAlpha(text) {
  if (!ALEPH_KEY) {
    throw new Error("Aleph Alpha key missing");
  }

  const response = await withTimeout(
    axios.post(
      "https://api.aleph-alpha.com/complete",
      {
        model: "luminous-base",
        prompt: `
Analyze this contract and return STRICT JSON:

${text}

JSON format:
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

  const textResponse = response?.data?.completion;

  return {
    provider: "aleph_alpha",
    analysis: safeParseJSON(textResponse) || {},
  };
}

/**
 * =========================================
 * 3. OPENAI (GLOBAL FALLBACK)
 * =========================================
 */

async function callOpenAI(text) {
  if (!OPENAI_KEY) {
    throw new Error("OpenAI key missing");
  }

  const response = await withTimeout(
    axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Return ONLY valid JSON for contract analysis.",
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

  const content = response?.data?.choices?.[0]?.message?.content;

  return {
    provider: "openai",
    analysis: safeParseJSON(content) || {},
  };
}

/**
 * =========================================
 * 4. SAFE FALLBACK (NO AI)
 * =========================================
 */

function fallbackAnalysis() {
  return {
    provider: "fallback",
    analysis: {
      contract_type: "General Contract",
      supplier_name: "Unknown",
      summary: "AI unavailable - fallback mode active.",
      risk_score: 0,
      contract_value: 0,
      clauses: [],
      obligations: [],
    },
  };
}

/**
 * =========================================
 * MAIN EU-FIRST ROUTER
 * =========================================
 */

export async function analyzeWithProviders(text) {
  /**
   * -----------------------------------------
   * STEP 1: MISTRAL (EU PRIMARY)
   * -----------------------------------------
   */

  try {
    const mistral = await callMistral(text);

    if (mistral?.analysis && Object.keys(mistral.analysis).length > 0) {
      return mistral;
    }
  } catch (err) {
    console.warn("Mistral failed:", err.message);
  }

  /**
   * -----------------------------------------
   * STEP 2: ALEPH ALPHA (EU FALLBACK)
   * -----------------------------------------
   */

  try {
    const aleph = await callAlephAlpha(text);

    if (aleph?.analysis && Object.keys(aleph.analysis).length > 0) {
      return aleph;
    }
  } catch (err) {
    console.warn("Aleph Alpha failed:", err.message);
  }

  /**
   * -----------------------------------------
   * STEP 3: OPENAI (GLOBAL FALLBACK)
   * -----------------------------------------
   */

  try {
    const openai = await callOpenAI(text);

    if (openai?.analysis && Object.keys(openai.analysis).length > 0) {
      return openai;
    }
  } catch (err) {
    console.warn("OpenAI failed:", err.message);
  }

  /**
   * -----------------------------------------
   * STEP 4: SAFE FALLBACK
   * -----------------------------------------
   */

  return fallbackAnalysis();
}

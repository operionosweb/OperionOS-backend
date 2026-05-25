// services/aiProviders.js

/**
 * =========================================
 * OPERION OS - AI PROVIDERS LAYER
 * EU-FIRST MULTI-MODEL ROUTING ENGINE
 * =========================================
 *
 * PRIORITY:
 * 1. Mistral (EU-first)
 * 2. Aleph Alpha (EU sovereign)
 * 3. OpenAI fallback
 *
 * FEATURES:
 * - Failover chain
 * - Provider health tracking
 * - Timeout protection
 * - Structured normalization
 * - Cost-aware architecture ready
 * - Future provider expansion ready
 * =========================================
 */

import OpenAI from "openai";
import axios from "axios";

/* ======================================================
   OPENAI CLIENT
====================================================== */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ======================================================
   PROVIDER HEALTH MEMORY
====================================================== */

const providerHealth = {
  mistral: {
    healthy: true,
    last_failure: null,
  },

  aleph_alpha: {
    healthy: true,
    last_failure: null,
  },

  openai: {
    healthy: true,
    last_failure: null,
  },
};

/* ======================================================
   PROVIDER FAILURE TRACKING
====================================================== */

function markProviderFailure(provider, error) {
  providerHealth[provider] = {
    healthy: false,
    last_failure: {
      timestamp: new Date().toISOString(),
      error: error?.message || "Unknown failure",
    },
  };
}

function markProviderHealthy(provider) {
  providerHealth[provider] = {
    healthy: true,
    last_failure: null,
  };
}

/* ======================================================
   EXPORTABLE HEALTH STATUS
====================================================== */

export function getProviderHealth() {
  return providerHealth;
}

/* ======================================================
   SAFE JSON PARSER
====================================================== */

function safeJsonParse(str) {
  try {
    if (!str) return {};

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

/* ======================================================
   NORMALIZED OUTPUT FORMAT
====================================================== */

function normalizeOutput(provider, raw) {
  try {
    return {
      provider,

      analysis: {
        contract_type:
          raw?.contract_type ||
          raw?.type ||
          "General Contract",

        supplier_name:
          raw?.supplier_name ||
          raw?.vendor ||
          "Unknown",

        summary:
          raw?.summary ||
          raw?.message ||
          "AI analysis completed.",

        risk_score:
          typeof raw?.risk_score === "number"
            ? raw.risk_score
            : 0,

        contract_value:
          typeof raw?.contract_value === "number"
            ? raw.contract_value
            : 0,

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

/* ======================================================
   SYSTEM PROMPT
====================================================== */

const SYSTEM_PROMPT = `
You are an enterprise contract intelligence engine.

Return ONLY valid JSON.

Required JSON schema:

{
  "contract_type": "string",
  "supplier_name": "string",
  "summary": "string",
  "risk_score": number,
  "contract_value": number,
  "clauses": [],
  "obligations": []
}
`;

/* ======================================================
   MISTRAL (EU PRIMARY)
====================================================== */

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
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],

      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },

      timeout: 25000,
    }
  );

  const content =
    response?.data?.choices?.[0]?.message?.content;

  markProviderHealthy("mistral");

  return normalizeOutput(
    "mistral",
    safeJsonParse(content)
  );
}

/* ======================================================
   ALEPH ALPHA (EU SOVEREIGN)
====================================================== */

async function callAlephAlpha(text) {
  if (!process.env.ALEPH_ALPHA_API_KEY) {
    throw new Error("ALEPH_ALPHA_API_KEY missing");
  }

  const response = await axios.post(
    "https://api.aleph-alpha.com/complete",
    {
      model: "luminous-base",

      prompt: `
${SYSTEM_PROMPT}

Contract:
${text}
      `,

      maximum_tokens: 800,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.ALEPH_ALPHA_API_KEY}`,
        "Content-Type": "application/json",
      },

      timeout: 25000,
    }
  );

  const content =
    response?.data?.completions?.[0]?.completion;

  markProviderHealthy("aleph_alpha");

  return normalizeOutput(
    "aleph_alpha",
    safeJsonParse(content)
  );
}

/* ======================================================
   OPENAI FALLBACK
====================================================== */

async function callOpenAI(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response =
    await openai.chat.completions.create({
      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],

      temperature: 0.1,
    });

  const content =
    response?.choices?.[0]?.message?.content;

  markProviderHealthy("openai");

  return normalizeOutput(
    "openai",
    safeJsonParse(content)
  );
}

/* ======================================================
   PROVIDER EXECUTOR
====================================================== */

async function executeProvider(provider, text) {
  switch (provider) {
    case "mistral":
      return await callMistral(text);

    case "aleph_alpha":
      return await callAlephAlpha(text);

    case "openai":
      return await callOpenAI(text);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/* ======================================================
   EU-FIRST PROVIDER ORDER
====================================================== */

function getProviderPriority() {
  return [
    "mistral",
    "aleph_alpha",
    "openai",
  ];
}

/* ======================================================
   MAIN ROUTER
====================================================== */

export async function analyzeWithProviders(
  text,
  providerHint = null
) {
  try {
    /**
     * -----------------------------------------
     * DIRECT PROVIDER REQUEST
     * -----------------------------------------
     */

    if (providerHint) {
      return await executeProvider(
        providerHint,
        text
      );
    }

    /**
     * -----------------------------------------
     * EU-FIRST FAILOVER CHAIN
     * -----------------------------------------
     */

    const providers = getProviderPriority();

    for (const provider of providers) {
      try {
        console.log(
          `🧠 Attempting provider: ${provider}`
        );

        const result =
          await executeProvider(provider, text);

        console.log(
          `✅ Provider success: ${provider}`
        );

        return result;
      } catch (error) {
        console.warn(
          `❌ Provider failed: ${provider}`,
          error.message
        );

        markProviderFailure(provider, error);
      }
    }

    /**
     * -----------------------------------------
     * TOTAL FAILURE
     * -----------------------------------------
     */

    throw new Error(
      "All AI providers failed"
    );
  } catch (error) {
    console.error(
      "AI Routing Fatal Error:",
      error
    );

    return {
      provider: "error",

      analysis: {
        contract_type: "General Contract",
        supplier_name: "Unknown",
        summary:
          "All AI providers failed",

        risk_score: 0,
        contract_value: 0,
        clauses: [],
        obligations: [],
      },
    };
  }
}

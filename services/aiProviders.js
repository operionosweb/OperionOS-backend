// services/aiProviders.js

import OpenAI from "openai";
import crypto from "crypto";

/**
 * -----------------------------------------
 * ENV KEYS (SAFE OPTIONAL LOADING)
 * -----------------------------------------
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const ALEPH_ALPHA_KEY = process.env.ALEPH_ALPHA_API_KEY;

/**
 * -----------------------------------------
 * CLIENTS (ONLY INIT IF KEY EXISTS)
 * -----------------------------------------
 */

const openaiClient = OPENAI_KEY
  ? new OpenAI({ apiKey: OPENAI_KEY })
  : null;

/**
 * -----------------------------------------
 * SIMPLE HASH (for cache keys later if needed)
 * -----------------------------------------
 */

function hashText(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * 🧠 LOCAL FALLBACK (ALWAYS WORKS)
 * -----------------------------------------
 */

function localFallbackAnalysis(text = "") {
  const lower = text.toLowerCase();

  let riskScore = 15;

  const riskKeywords = [
    "termination",
    "liability",
    "indemnify",
    "penalty",
    "breach",
    "default",
    "without limitation",
    "exclusive",
  ];

  for (const k of riskKeywords) {
    if (lower.includes(k)) riskScore += 6;
  }

  return {
    contract_type: lower.includes("lease")
      ? "Lease Agreement"
      : "General Contract",

    supplier_name: "Unknown Supplier",

    summary:
      "Fallback local analysis used (no AI provider available).",

    risk_score: Math.min(100, riskScore),

    contract_value: 0,

    clauses: [],
    obligations: [],
  };
}

/**
 * -----------------------------------------
 * 🇪🇺 MISTRAL (PRIMARY EU PROVIDER)
 * -----------------------------------------
 * NOTE: Placeholder safe implementation
 * (You will plug real endpoint later)
 * -----------------------------------------
 */

async function callMistral(text) {
  if (!MISTRAL_KEY) return null;

  try {
    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MISTRAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small",
          messages: [
            {
              role: "system",
              content:
                "You are a legal contract analysis engine. Return JSON only.",
            },
            {
              role: "user",
              content: text,
            },
          ],
          temperature: 0.2,
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) return null;

    return safeParseJSON(content);
  } catch (err) {
    return null;
  }
}

/**
 * -----------------------------------------
 * 🇪🇺 ALEPH ALPHA (OPTIONAL EU PROVIDER)
 * -----------------------------------------
 * SAFE: will NEVER break pipeline
 * -----------------------------------------
 */

async function callAlephAlpha(text) {
  if (!ALEPH_ALPHA_KEY) return null;

  try {
    const response = await fetch(
      "https://api.aleph-alpha.com/complete",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ALEPH_ALPHA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "luminous-base",
          prompt: `Analyze this contract:\n\n${text}`,
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    const textOut = data?.completions?.[0]?.completion;

    if (!textOut) return null;

    return safeParseJSON(textOut);
  } catch (err) {
    return null;
  }
}

/**
 * -----------------------------------------
 * 🇺🇸 OPENAI FALLBACK
 * -----------------------------------------
 */

async function callOpenAI(text) {
  if (!openaiClient) return null;

  try {
    const response =
      await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Return structured JSON contract analysis only.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.2,
      });

    const content =
      response?.choices?.[0]?.message?.content;

    return safeParseJSON(content);
  } catch (err) {
    return null;
  }
}

/**
 * -----------------------------------------
 * SAFE JSON PARSER
 * -----------------------------------------
 */

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

/**
 * -----------------------------------------
 * MAIN EU-FIRST ROUTER
 * -----------------------------------------
 */

export async function analyzeWithProviders(rawText = "") {
  if (!rawText) {
    return {
      success: false,
      error: "No input text",
    };
  }

  /**
   * 1. 🇪🇺 MISTRAL FIRST
   */
  const mistral = await callMistral(rawText);
  if (mistral) {
    return {
      success: true,
      provider: "mistral",
      analysis: mistral,
    };
  }

  /**
   * 2. 🇪🇺 ALEPH ALPHA (OPTIONAL)
   */
  const aleph = await callAlephAlpha(rawText);
  if (aleph) {
    return {
      success: true,
      provider: "aleph_alpha",
      analysis: aleph,
    };
  }

  /**
   * 3. 🇺🇸 OPENAI FALLBACK
   */
  const openai = await callOpenAI(rawText);
  if (openai) {
    return {
      success: true,
      provider: "openai",
      analysis: openai,
    };
  }

  /**
   * 4. 🧱 LOCAL FALLBACK (GUARANTEED)
   */
  return {
    success: true,
    provider: "local_fallback",
    analysis: localFallbackAnalysis(rawText),
  };
}

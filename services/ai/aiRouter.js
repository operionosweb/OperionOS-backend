import OpenAI from "openai";

/**
 * =========================================
 * OPERION AI ROUTER (EU-FIRST)
 * =========================================
 * Strategy:
 * 1. Mistral (EU primary)
 * 2. Aleph Alpha (EU sovereign fallback - optional)
 * 3. OpenAI (global fallback)
 * =========================================
 */

/**
 * -----------------------------------------
 * PROVIDER CONFIG
 * -----------------------------------------
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * -----------------------------------------
 * ROUTING DECISION ENGINE
 * -----------------------------------------
 */

function selectProvider({ contractType, riskScore }) {
  const risk = Number(riskScore || 0);

  /**
   * HIGH RISK → strongest reasoning model
   */
  if (risk >= 70) {
    return "openai";
  }

  /**
   * LEGAL / CONTRACTUAL COMPLEXITY
   */
  if (
    contractType?.includes("Lease") ||
    contractType?.includes("Procurement")
  ) {
    return "mistral";
  }

  /**
   * DEFAULT EU-FIRST
   */
  return "mistral";
}

/**
 * -----------------------------------------
 * MOCK: MISTRAL CALL (replace with API later)
 * -----------------------------------------
 */

async function callMistral(prompt) {
  try {
    /**
     * NOTE:
     * You will later replace this with:
     * https://api.mistral.ai/v1/chat/completions
     */

    return {
      provider: "mistral",
      output: `Mistral analysis: ${prompt.substring(0, 200)}...`
    };

  } catch (err) {
    throw new Error("Mistral failed");
  }
}

/**
 * -----------------------------------------
 * MOCK: ALEPH ALPHA (future integration)
 * -----------------------------------------
 */

async function callAlephAlpha(prompt) {
  try {
    /**
     * Placeholder (API not required yet)
     */

    return {
      provider: "aleph_alpha",
      output: `Aleph Alpha analysis: ${prompt.substring(0, 200)}...`
    };

  } catch (err) {
    throw new Error("Aleph Alpha failed");
  }
}

/**
 * -----------------------------------------
 * OPENAI FALLBACK
 * -----------------------------------------
 */

async function callOpenAI(prompt) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are Operion AI contract intelligence engine."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return {
    provider: "openai",
    output: response.choices[0].message.content
  };
}

/**
 * -----------------------------------------
 * MAIN ROUTER
 * -----------------------------------------
 */

export async function runAIAnalysis({
  prompt,
  contractType,
  riskScore
}) {
  try {
    const provider = selectProvider({
      contractType,
      riskScore
    });

    let result;

    /**
     * EU-FIRST ROUTING CHAIN
     */

    if (provider === "mistral") {
      try {
        result = await callMistral(prompt);
      } catch (e) {
        console.warn("Mistral failed → fallback OpenAI");
        result = await callOpenAI(prompt);
      }
    }

    if (provider === "aleph_alpha") {
      try {
        result = await callAlephAlpha(prompt);
      } catch (e) {
        console.warn("Aleph Alpha failed → fallback OpenAI");
        result = await callOpenAI(prompt);
      }
    }

    if (provider === "openai") {
      result = await callOpenAI(prompt);
    }

    return {
      success: true,
      provider_used: result.provider,
      output: result.output,
      routing_decision: provider
    };

  } catch (error) {
    console.error("AI Router error:", error);

    return {
      success: false,
      error: error.message || "AI routing failed"
    };
  }
}

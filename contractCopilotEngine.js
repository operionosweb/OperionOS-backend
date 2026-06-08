import axios from "axios";

/* =========================================
   SAFE JSON PARSER (HARDENED)
========================================= */

function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    try {
      // attempt to extract JSON block if model adds noise
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return null;
    } catch {
      return null;
    }
  }
}

/* =========================================
   LLM CALL (MISTRAL → OPENROUTER FALLBACK)
========================================= */

async function callLLM(prompt) {
  try {
    /* =========================
       1. MISTRAL (EU-FIRST)
    ========================= */
    if (process.env.MISTRAL_API_KEY) {
      const res = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.data?.choices?.[0]?.message?.content;
    }

    /* =========================
       2. OPENROUTER (EU FRIENDLY)
    ========================= */
    if (process.env.OPENROUTER_API_KEY) {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistral/mistral-large",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.data?.choices?.[0]?.message?.content;
    }

    /* =========================
       3. OPENAI (LAST RESORT)
    ========================= */
    if (process.env.OPENAI_API_KEY) {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.data?.choices?.[0]?.message?.content;
    }

    throw new Error("No LLM provider configured");

  } catch (err) {
    console.error("LLM ERROR:", err?.response?.data || err.message);
    throw new Error("Copilot AI failed");
  }
}

/* =========================================
   MAIN COPILOT ENGINE
========================================= */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an aviation contract negotiation copilot.

Analyze this contract intelligence:

SUMMARY:
${contract.summary || ""}

OVERALL RISK:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

{
  "recommendation": "SIGN | REJECT | NEGOTIATE",
  "confidence": 0-100,
  "why": "",
  "top_risks": [],
  "negotiation_points": [],
  "cost_exposure_summary": "",
  "board_summary": "",
  "action_plan": []
}

Rules:
- Be strict and realistic
- Aviation industry focus
- NO markdown
- NO extra text
`;

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!parsed) {
      console.error("❌ Copilot JSON parse failed. Raw output:", raw);

      return {
        recommendation: "NEGOTIATE",
        confidence: 50,
        why: "Fallback due to AI parsing failure",
        top_risks: [],
        negotiation_points: [],
        cost_exposure_summary: "",
        board_summary: "",
        action_plan: [],
      };
    }

    return parsed;

  } catch (err) {
    console.error("COPILOT ENGINE ERROR:", err.message);

    return {
      recommendation: "NEGOTIATE",
      confidence: 40,
      why: "System fallback due to execution error",
      top_risks: [],
      negotiation_points: [],
      cost_exposure_summary: "",
      board_summary: "",
      action_plan: [],
    };
  }
}

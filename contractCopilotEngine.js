import axios from "axios";

/* ===============================
   EU LLM CALL (MISTRAL ONLY)
=============================== */

async function callLLM(prompt) {
  try {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY missing");
    }

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

    return res.data.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("LLM error:", err.message);
    throw new Error("Copilot AI failed (Mistral only mode)");
  }
}

/* ===============================
   SAFE JSON PARSER
=============================== */

function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (e) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;

      return JSON.parse(match[0]);
    } catch (err) {
      return null;
    }
  }
}

/* ===============================
   MAIN COPILOT ENGINE
=============================== */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an aviation contract negotiation copilot.

STRICT OUTPUT RULES:
- Return ONLY raw JSON
- No markdown
- No explanations
- No extra text
- No backticks

Return EXACT JSON:

{
  "recommendation": "SIGN | REJECT | NEGOTIATE",
  "confidence": 0-100,
  "why": "string",
  "top_risks": [],
  "negotiation_points": [],
  "cost_exposure_summary": "",
  "board_summary": "",
  "action_plan": []
}

CONTRACT SUMMARY:
${contract.summary || ""}

OVERALL RISK:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}
`;

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        recommendation: "NEGOTIATE",
        confidence: 50,
        why: "AI parsing failure fallback",
        top_risks: [],
        negotiation_points: [],
        cost_exposure_summary: "",
        board_summary: "",
        action_plan: [],
      };
    }

    return parsed;
  } catch (err) {
    console.error("Copilot engine error:", err.message);

    return {
      success: false,
      error: "Copilot generation failed",
    };
  }
}

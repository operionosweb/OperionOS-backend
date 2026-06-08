import axios from "axios";

/* ===============================
   HYBRID AI CALL (MISTRAL FIRST)
=============================== */

async function callLLM(prompt) {
  try {
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

      return res.data.choices?.[0]?.message?.content;
    }

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

    return res.data.choices?.[0]?.message?.content;
  } catch (err) {
    console.error("LLM error:", err.message);
    throw new Error("Copilot AI failed");
  }
}

/* ===============================
   SAFE JSON PARSER (FIXED)
=============================== */

function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    // First attempt: strict JSON parse
    return JSON.parse(text);
  } catch (e) {
    try {
      // Second attempt: extract JSON block from messy LLM output
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
- No backticks
- No extra text before or after JSON

Return EXACTLY this structure:

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

    throw new Error("Contract copilot generation failed");
  }
}

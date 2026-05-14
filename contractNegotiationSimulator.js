import axios from "axios";

/* ===============================
   HYBRID LLM CALL (MISTRAL FIRST)
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
    throw new Error("Negotiation AI failed");
  }
}

/* ===============================
   SAFE JSON PARSER
=============================== */

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ===============================
   MAIN SIMULATOR ENGINE
=============================== */

export async function generateNegotiationSimulation({
  contract,
  company_context = {}
}) {
  try {

    const prompt = `
You are an expert aviation contract negotiator.

You work for an AIRLINE negotiating with aircraft LESSORS.

Analyze this contract:

SUMMARY:
${contract.summary || ""}

RISK SCORE:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

{
  "leverage_score": 0-100,
  "position": "AIRLINE_FAVORABLE | LESSOR_FAVORABLE | BALANCED",
  "key_pressure_points": ["", "", ""],
  "money_saving_opportunities": [
    {
      "clause": "",
      "strategy": "",
      "estimated_savings": ""
    }
  ],
  "counteroffers": [
    {
      "original_clause": "",
      "proposed_change": "",
      "justification": ""
    }
  ],
  "fallback_positions": ["", "", ""],
  "risk_tradeoffs": [
    {
      "risk": "",
      "impact": "",
      "mitigation": ""
    }
  ],
  "executive_summary": ""
}

Rules:
- Be realistic like a senior aviation lawyer
- Focus on lease contracts, penalties, maintenance obligations, downtime clauses
- Always assume airline wants lower cost + more flexibility
- No markdown, no extra text
`;

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        leverage_score: 50,
        position: "BALANCED",
        key_pressure_points: [],
        money_saving_opportunities: [],
        counteroffers: [],
        fallback_positions: [],
        risk_tradeoffs: [],
        executive_summary: "AI parsing failed fallback response"
      };
    }

    return parsed;

  } catch (err) {
    console.error("Negotiation simulator error:", err.message);
    throw new Error("Negotiation simulation failed");
  }
}

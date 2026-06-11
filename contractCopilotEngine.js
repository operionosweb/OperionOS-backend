import axios from "axios";

/* =========================================
   SAFE JSON PARSER
========================================= */

function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return null;
    } catch {
      return null;
    }
  }
}

/* =========================================
   LLM CALL
========================================= */

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

      return res.data?.choices?.[0]?.message?.content;
    }

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
   MAIN DECISION CHAIN COPILOT ENGINE
========================================= */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an aviation contract intelligence system used by airlines and lessors.

Your job is NOT to summarize contracts.

Your job is to produce a DECISION CHAIN for operational use.

For each clause, extract:

- clause
- obligation (what is required)
- risk_trigger (what event causes risk)
- operational_consequence (what happens in real aviation operations)
- owner (who in airline organization is responsible)
- recommendation (what to do in negotiation or execution)

Owners must be EXACTLY one of:
Technical Services
Finance
Asset Management
Ground Operations
Flight Operations
Compliance
Legal

CONTRACT DATA:
${JSON.stringify(contract?.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

{
  "decision_chain": [
    {
      "clause": "",
      "obligation": "",
      "risk_trigger": "",
      "operational_consequence": "",
      "owner": "",
      "recommendation": ""
    }
  ],

  "executive_summary": "",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL"
}

Rules:
- Aviation operational thinking only
- No marketing language
- No extra text
- No markdown
`;

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        decision_chain: [],
        executive_summary: "Fallback due to parsing failure",
        risk_level: "MEDIUM",
      };
    }

    return parsed;

  } catch (err) {
    console.error("COPILOT ENGINE ERROR:", err.message);

    return {
      decision_chain: [],
      executive_summary: "System error fallback",
      risk_level: "MEDIUM",
    };
  }
}

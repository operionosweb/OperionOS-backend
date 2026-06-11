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
   EU-FIRST LLM ROUTER
========================================= */

async function callLLM(prompt) {
  try {
    console.log("🧠 LLM ENV CHECK:", {
      mistral: !!process.env.MISTRAL_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    });

    // 1. MISTRAL (EU FIRST)
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

    // 2. OPENROUTER (EU fallback)
    if (process.env.OPENROUTER_API_KEY) {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-large",
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

    // 3. OPENAI (last resort)
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
   AIRLINE OPERATIONS DECISION ENGINE
========================================= */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an AIRLINE OPERATIONS DECISION ENGINE.

You convert aviation lease/maintenance contracts into operational decision chains.

DO NOT summarize.

For each clause output:

- clause
- obligation (what must be done)
- risk_trigger (what failure activates risk)
- operational_consequence (real airline impact)
- owner (must be EXACTLY one of:
  Technical Services,
  Finance,
  Asset Management,
  Ground Operations,
  Flight Operations,
  Compliance,
  Legal)
- recommendation (action to mitigate risk)

AIRLINE RULES:
- Aircraft availability issues → Flight Ops + Technical Services
- Maintenance obligations → Technical Services
- Financial exposure → Finance
- Return conditions → Asset Management
- Compliance risk → Compliance/Legal

CONTRACT:
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
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "top_operational_risks": [
    {
      "issue": "",
      "impact": "",
      "severity": ""
    }
  ]
}
`;

    const raw = await callLLM(prompt);
    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        decision_chain: [],
        executive_summary: "Fallback due to parsing failure",
        risk_level: "MEDIUM",
        top_operational_risks: [],
      };
    }

    return parsed;
  } catch (err) {
    console.error("COPILOT ENGINE ERROR:", err.message);

    return {
      decision_chain: [],
      executive_summary: "System error fallback",
      risk_level: "MEDIUM",
      top_operational_risks: [],
    };
  }
}
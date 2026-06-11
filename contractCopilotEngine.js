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
EU-FIRST LLM ROUTER (MISTRAL → OPENROUTER → OPENAI)
========================================= */

async function callLLM(prompt) {
  try {
    console.log("🧠 LLM ENV CHECK:", {
      mistral: !!process.env.MISTRAL_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    });

    /* =========================
       1. MISTRAL (EU PRIMARY)
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
       2. OPENROUTER (EU AGGREGATOR)
    ========================= */
    if (process.env.OPENROUTER_API_KEY) {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistral/mistral-large-latest",
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
    console.error("❌ LLM ERROR:", err?.response?.data || err.message);
    throw new Error("Copilot AI failed");
  }
}

/* =========================================
MAIN COPILOT ENGINE (AVIATION DECISION CHAIN)
========================================= */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an AIRLINE OPERATIONS DECISION ENGINE.

You convert aviation contracts into operational decision chains.

You DO NOT summarize.

You extract structured operational intelligence.

For each clause produce:
- clause
- obligation
- risk_trigger
- operational_consequence
- owner (Technical Services, Finance, Asset Management, Ground Operations, Flight Operations, Compliance, Legal)
- recommendation

AIRLINE MAPPING RULES:
- Aircraft availability → Flight Operations + Technical Services
- Maintenance obligations → Technical Services
- Financial exposure → Finance
- Return conditions → Asset Management
- Compliance risk → Compliance / Legal

CONTRACT CLAUSES:
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

Rules:
- Aviation operational thinking only
- No markdown
- No extra text
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
    console.error("❌ COPILOT ENGINE ERROR:", err.message);

    return {
      decision_chain: [],
      executive_summary: "System error fallback",
      risk_level: "MEDIUM",
      top_operational_risks: [],
    };
  }
}
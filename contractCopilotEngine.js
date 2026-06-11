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
       2. OPENROUTER (EU FALLBACK)
    ========================= */
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
   AIRCRAFT OPERATIONS DECISION COPILOT
========================================= */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an aviation OPERATIONS DECISION ENGINE.

You do NOT summarize contracts.

You convert each clause into a REAL operational decision chain used by airlines.

Each clause must map to:

1. clause (original meaning)
2. obligation (what must be done)
3. risk_trigger (what failure triggers risk)
4. operational_consequence (real airline impact)
5. owner (ONLY one of:
   Technical Services,
   Finance,
   Asset Management,
   Ground Operations,
   Flight Operations,
   Compliance,
   Legal)
6. recommendation (what action to take)

IMPORTANT RULES:
- Think like airline operations control center
- Focus on maintenance, airworthiness, lease return, insurance, penalties
- If clause is vague → mark HIGH operational risk
- If clause affects aircraft availability → prioritize Flight Operations + Technical Services
- If financial exposure → Finance
- If compliance/legal exposure → Compliance/Legal

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

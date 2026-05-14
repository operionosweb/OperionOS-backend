import axios from "axios";

/* ===============================
   HYBRID AI CALL (MISTRAL + OPENAI READY)
=============================== */

async function callLLM(prompt) {
  try {
    // PRIMARY: Mistral (EU-first)
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

    // FALLBACK: OpenAI
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
    console.error("LLM call failed:", err.message);
    throw new Error("AI reasoning failed");
  }
}

/* ===============================
   PARSE SAFE JSON
=============================== */

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ===============================
   MAIN REASONING ENGINE
=============================== */

export async function reasonClause(clause) {
  const prompt = `
You are an aviation contract legal analyst.

Analyze this clause:

TITLE: ${clause.title}
TEXT: ${clause.text}
RISK_SCORE: ${clause.risk_score || 0}

Return ONLY valid JSON:

{
  "why_risky": "",
  "legal_meaning": "",
  "business_impact": "",
  "negotiation_strategy": "",
  "safer_rewrite": ""
}

Rules:
- Be precise
- No markdown
- No extra text
- Focus on aviation / leasing / maintenance contracts
`;

  const raw = await callLLM(prompt);
  const parsed = safeParse(raw);

  if (!parsed) {
    return {
      why_risky: "Unable to parse AI output",
      legal_meaning: "",
      business_impact: "",
      negotiation_strategy: "",
      safer_rewrite: ""
    };
  }

  return parsed;
}

/* ===============================
   BULK CLAUSE ANALYSIS
=============================== */

export async function reasonClauses(clauses = []) {
  const results = [];

  for (const clause of clauses) {
    const reasoning = await reasonClause(clause);

    results.push({
      ...clause,
      reasoning
    });
  }

  return results;
}

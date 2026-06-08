import axios from "axios";
import supabase from "./config/supabase.js"; // ✅ FIXED PATH

/* ===============================
   EU LLM CALL (MISTRAL ONLY)
=============================== */

async function callLLM(prompt) {
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
   VALIDATION
=============================== */

function isValid(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.recommendation === "string" &&
    typeof obj.confidence === "number"
  );
}

/* ===============================
   VECTOR CONTEXT FETCH
=============================== */

async function getSimilarContracts() {
  try {
    const { data, error } = await supabase
      .from("contract_embeddings")
      .select("metadata")
      .limit(5);

    if (error) throw error;

    return (data || []).map((d) => d.metadata || []);
  } catch (err) {
    console.error("Vector fetch error:", err.message);
    return [];
  }
}

/* ===============================
   CONTEXT BUILDER
=============================== */

function buildContext(similarContracts = []) {
  if (!similarContracts.length) return "";

  return `
SIMILAR CONTRACT INTELLIGENCE:

${similarContracts
  .map((c, i) => {
    return `
[${i + 1}]
Supplier: ${c.supplier_name || "Unknown"}
Risk Score: ${c.risk_score || "N/A"}
Summary: ${c.summary || ""}
`;
  })
  .join("\n")}
`;
}

/* ===============================
   PROMPT
=============================== */

function buildPrompt(contract, context) {
  return `
You are an aviation contract negotiation AI.

Use historical contract intelligence to improve decisions.

${context}

CURRENT CONTRACT:

Summary:
${contract.summary || ""}

Risk:
${contract.overall_risk || 0}

Clauses:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

RETURN ONLY VALID JSON:

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
`;
}

/* ===============================
   MAIN ENGINE
=============================== */

export async function generateContractCopilot({
  contract,
  contractId,
}) {
  try {
    const similarContracts = await getSimilarContracts(contractId);
    const context = buildContext(similarContracts);

    const prompt = buildPrompt(contract, context);

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!isValid(parsed)) {
      const repairPrompt = `
Fix into VALID JSON ONLY:

${raw}
`;
      const raw2 = await callLLM(repairPrompt);
      const parsed2 = safeParse(raw2);

      if (isValid(parsed2)) return parsed2;
    }

    if (isValid(parsed)) return parsed;

    return {
      recommendation: "NEGOTIATE",
      confidence: 60,
      why: "Fallback after Copilot failure",
      top_risks: ["AI instability"],
      negotiation_points: [],
      cost_exposure_summary: "",
      board_summary: "",
      action_plan: [],
    };
  } catch (err) {
    console.error("Copilot engine error:", err.message);

    return {
      success: false,
      error: "Copilot failed",
    };
  }
}

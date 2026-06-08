import axios from "axios";

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
   VALIDATION CHECK
=============================== */

function isValidCopilot(obj) {
  if (!obj || typeof obj !== "object") return false;

  return (
    typeof obj.recommendation === "string" &&
    typeof obj.confidence === "number" &&
    typeof obj.why === "string"
  );
}

/* ===============================
   PROMPT BUILDER
=============================== */

function buildPrompt(contract) {
  return `
You are an aviation contract negotiation copilot.

STRICT RULES:
- Output ONLY valid JSON
- No markdown
- No explanation
- No text before or after JSON

RETURN FORMAT:

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

RISK SCORE:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}
`;
}

/* ===============================
   MAIN COPILOT ENGINE (HARD MODE)
=============================== */

export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = buildPrompt(contract);

    // FIRST ATTEMPT
    const raw1 = await callLLM(prompt);
    let parsed = safeParse(raw1);

    // SECOND ATTEMPT (AUTO-RETRY)
    if (!isValidCopilot(parsed)) {
      const repairPrompt = `
Fix this output into valid JSON ONLY:

${raw1}

Return ONLY valid JSON in correct format.
`;

      const raw2 = await callLLM(repairPrompt);
      parsed = safeParse(raw2);
    }

    // FINAL FALLBACK (CONTROLLED)
    if (!isValidCopilot(parsed)) {
      return {
        recommendation: "NEGOTIATE",
        confidence: 60,
        why: "Fallback after failed structured generation",
        top_risks: ["AI output instability"],
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

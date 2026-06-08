import axios from "axios";

/**
 * =========================================
 * SAFE JSON PARSER
 * =========================================
 */
function safeParse(text) {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("❌ JSON Parse Failed:", err.message);

    /**
     * TRY CLEANING COMMON LLM OUTPUT ISSUES
     */
    try {
      const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      return JSON.parse(cleaned);
    } catch (err2) {
      console.error("❌ Cleaned JSON Parse Failed:", err2.message);
      return null;
    }
  }
}

/**
 * =========================================
 * HYBRID LLM CALL
 * =========================================
 */
async function callLLM(prompt) {
  try {
    /**
     * MISTRAL FIRST (EU OPTION)
     */
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

    /**
     * FALLBACK: OPENAI
     */
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

    throw new Error("No LLM API key configured");
  } catch (err) {
    console.error("❌ LLM ERROR:", err.response?.data || err.message);
    throw new Error("Copilot AI failed");
  }
}

/**
 * =========================================
 * MAIN COPILOT ENGINE
 * =========================================
 */
export async function generateContractCopilot({
  contract,
  company_context = {},
}) {
  try {
    const prompt = `
You are an aviation contract negotiation copilot.

Analyze this contract:

SUMMARY:
${contract.summary || ""}

RISK SCORE:
${contract.risk_score || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

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

Rules:
- Be strict and realistic
- Focus on aviation leasing risk
- NO markdown
- NO extra text
`;

    const raw = await callLLM(prompt);

    console.log("🔵 RAW COPILOT OUTPUT:", raw);

    const parsed = safeParse(raw);

    if (!parsed) {
      return {
        recommendation: "NEGOTIATE",
        confidence: 50,
        why: "Fallback due to invalid JSON from LLM",
        top_risks: [],
        negotiation_points: [],
        cost_exposure_summary: "",
        board_summary: "",
        action_plan: [],
      };
    }

    return parsed;
  } catch (err) {
    console.error("❌ COPILOT ERROR:", err.message);

    return {
      recommendation: "NEGOTIATE",
      confidence: 50,
      why: "System fallback error",
      top_risks: [],
      negotiation_points: [],
      cost_exposure_summary: "",
      board_summary: "",
      action_plan: [],
    };
  }
}

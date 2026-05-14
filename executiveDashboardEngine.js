import axios from "axios";

/* ===============================
   HYBRID AI CALL
=============================== */

async function callLLM(prompt) {

  try {

    /* ===============================
       MISTRAL FIRST
    =============================== */

    if (process.env.MISTRAL_API_KEY) {

      const response =
        await axios.post(
          "https://api.mistral.ai/v1/chat/completions",
          {
            model: "mistral-large-latest",

            messages: [
              {
                role: "user",
                content: prompt
              }
            ],

            temperature: 0.1
          },
          {
            headers: {
              Authorization:
                `Bearer ${process.env.MISTRAL_API_KEY}`,

              "Content-Type":
                "application/json"
            }
          }
        );

      return response.data
        .choices?.[0]
        ?.message
        ?.content;
    }

    /* ===============================
       OPENAI FALLBACK
    =============================== */

    const response =
      await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",

          messages: [
            {
              role: "user",
              content: prompt
            }
          ],

          temperature: 0.1
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,

            "Content-Type":
              "application/json"
          }
        }
      );

    return response.data
      .choices?.[0]
      ?.message
      ?.content;

  } catch (err) {

    console.error(
      "Dashboard AI failed:",
      err.message
    );

    throw new Error(
      "Dashboard AI generation failed"
    );

  }

}

/* ===============================
   SAFE PARSER
=============================== */

function safeParse(text) {

  try {

    return JSON.parse(text);

  } catch {

    return null;

  }

}

/* ===============================
   EXECUTIVE DASHBOARD ENGINE
=============================== */

export async function generateExecutiveDashboard({
  contracts
}) {

  try {

    const prompt = `
You are an aviation executive intelligence engine.

Analyze this airline leasing and maintenance contract portfolio.

PORTFOLIO DATA:
${JSON.stringify(contracts).slice(0, 25000)}

Return ONLY valid JSON:

{
  "portfolio_summary": {
    "total_contracts": 0,
    "high_risk_contracts": 0,
    "critical_contracts": 0,
    "average_risk_score": 0,
    "estimated_total_exposure_usd": 0
  },

  "top_risk_contracts": [
    {
      "contract_id": "",
      "risk_score": 0,
      "reason": ""
    }
  ],

  "lessor_risk_distribution": [
    {
      "lessor": "",
      "average_risk": 0,
      "contracts": 0
    }
  ],

  "risk_categories": {
    "financial": 0,
    "maintenance": 0,
    "operational": 0,
    "redelivery": 0,
    "penalty": 0
  },

  "executive_insights": [
    ""
  ],

  "recommended_actions": [
    ""
  ],

  "renewal_risk_forecast": {
    "contracts_expiring_12_months": 0,
    "high_renewal_risk": 0,
    "projected_exposure": 0
  }
}

Rules:
- Think like an airline executive risk officer
- Focus on financial and operational exposure
- Return valid JSON only
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {
        portfolio_summary: {
          total_contracts: contracts.length || 0,
          high_risk_contracts: 0,
          critical_contracts: 0,
          average_risk_score: 50,
          estimated_total_exposure_usd: 0
        },

        top_risk_contracts: [],

        lessor_risk_distribution: [],

        risk_categories: {
          financial: 50,
          maintenance: 50,
          operational: 50,
          redelivery: 50,
          penalty: 50
        },

        executive_insights: [
          "Fallback AI parsing response"
        ],

        recommended_actions: [],

        renewal_risk_forecast: {
          contracts_expiring_12_months: 0,
          high_renewal_risk: 0,
          projected_exposure: 0
        }
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Executive dashboard failed:",
      err.message
    );

    throw new Error(
      "Executive dashboard generation failed"
    );

  }

}

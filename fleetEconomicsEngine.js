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
      "Fleet economics AI failed:",
      err.message
    );

    throw new Error(
      "Fleet economics generation failed"
    );

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
   FLEET ECONOMICS ENGINE
=============================== */

export async function generateFleetEconomics({
  contract
}) {

  try {

    const prompt = `
You are a senior aviation fleet finance strategist.

Analyze this aircraft lease contract from an airline CFO and fleet planning perspective.

Focus on:
- lease economics
- maintenance reserve burden
- long-term cashflow pressure
- ownership vs lease economics
- redelivery exposure
- maintenance event cost risk
- operational flexibility
- asset control
- liquidity impact

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON:

{
  "fleet_strategy_profile": {
    "overall_economic_score": 0,
    "lease_efficiency_score": 0,
    "cashflow_pressure_score": 0,
    "ownership_flexibility_score": 0,
    "long_term_risk_score": 0
  },

  "financial_exposure": {
    "estimated_total_lease_cost_usd": 0,
    "estimated_maintenance_reserve_cost_usd": 0,
    "estimated_redelivery_cost_usd": 0,
    "estimated_llp_exposure_usd": 0,
    "estimated_total_exposure_usd": 0
  },

  "lease_vs_ownership": {
    "preferred_model": "LEASE | OWNERSHIP | HYBRID",
    "strategic_reasoning": "",
    "ownership_advantages": [
      ""
    ],
    "lease_advantages": [
      ""
    ]
  },

  "cashflow_analysis": {
    "monthly_cashflow_pressure": "LOW | MODERATE | HIGH | EXTREME",
    "major_cashflow_risks": [
      ""
    ],
    "liquidity_impact": ""
  },

  "fleet_risk_analysis": {
    "major_operational_risks": [
      ""
    ],
    "major_financial_risks": [
      ""
    ],
    "major_technical_risks": [
      ""
    ]
  },

  "strategic_recommendations": [
    ""
  ],

  "executive_summary": ""
}

Rules:
- Think like aviation CFO + fleet planner
- Be commercially realistic
- Use aviation leasing logic
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {

        fleet_strategy_profile: {
          overall_economic_score: 50,
          lease_efficiency_score: 50,
          cashflow_pressure_score: 50,
          ownership_flexibility_score: 50,
          long_term_risk_score: 50
        },

        financial_exposure: {
          estimated_total_lease_cost_usd: 0,
          estimated_maintenance_reserve_cost_usd: 0,
          estimated_redelivery_cost_usd: 0,
          estimated_llp_exposure_usd: 0,
          estimated_total_exposure_usd: 0
        },

        lease_vs_ownership: {
          preferred_model: "HYBRID",
          strategic_reasoning:
            "Fallback parsing response",
          ownership_advantages: [],
          lease_advantages: []
        },

        cashflow_analysis: {
          monthly_cashflow_pressure:
            "MODERATE",
          major_cashflow_risks: [],
          liquidity_impact:
            "Fallback parsing response"
        },

        fleet_risk_analysis: {
          major_operational_risks: [],
          major_financial_risks: [],
          major_technical_risks: []
        },

        strategic_recommendations: [],

        executive_summary:
          "Fallback parsing response"
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Fleet economics engine failed:",
      err.message
    );

    throw new Error(
      "Fleet economics generation failed"
    );

  }

}

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
      "LLP forecasting AI failed:",
      err.message
    );

    throw new Error(
      "LLP forecasting failed"
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
   LLP FORECAST ENGINE
=============================== */

export async function generateLLPForecast({
  contract
}) {

  try {

    const prompt = `
You are a senior aviation engine asset management specialist.

Analyze this aircraft lease and engine maintenance structure.

Focus heavily on:
- LLP life consumption
- engine utilization forecasting
- shop visit timing
- maintenance reserve cashflow
- LLP replacement exposure
- engine overhaul economics
- cycle-driven deterioration
- lease-end engine exposure
- reserve sufficiency
- engine return conditions
- asset management risk

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON.

{
  "engine_overview": {
    "engine_risk_score": 0,
    "llp_exposure_level": "LOW | MODERATE | HIGH | EXTREME",
    "reserve_adequacy": "UNDERFUNDED | ADEQUATE | STRONG",
    "technical_asset_condition": "GOOD | MODERATE | POOR | CRITICAL"
  },

  "llp_forecast": {
    "estimated_remaining_cycles": 0,
    "estimated_remaining_hours": 0,
    "next_major_llp_event_months": 0,
    "estimated_llp_replacement_cost_usd": 0,
    "llp_consumption_rate": ""
  },

  "shop_visit_forecast": {
    "estimated_next_shop_visit_months": 0,
    "estimated_shop_visit_cost_usd": 0,
    "shop_visit_risk": "LOW | MODERATE | HIGH | EXTREME",
    "key_cost_drivers": [
      ""
    ]
  },

  "maintenance_reserve_forecast": {
    "estimated_reserve_balance_usd": 0,
    "expected_future_contributions_usd": 0,
    "projected_shortfall_usd": 0,
    "reserve_risk_level": "LOW | MODERATE | HIGH | EXTREME"
  },

  "utilization_analysis": {
    "utilization_pressure": "LOW | MODERATE | HIGH | EXTREME",
    "cycle_burn_risk": "",
    "operational_impact": ""
  },

  "lease_end_engine_exposure": {
    "lease_return_engine_risk": "LOW | MODERATE | HIGH | EXTREME",
    "estimated_end_of_lease_liability_usd": 0,
    "redelivery_risk_summary": ""
  },

  "strategic_recommendations": [
    ""
  ],

  "executive_summary": ""
}

Rules:
- Use real aviation engine economics logic
- Think like airline technical asset manager
- Think like engine lessor specialist
- Be commercially realistic
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {

        engine_overview: {
          engine_risk_score: 50,
          llp_exposure_level:
            "MODERATE",
          reserve_adequacy:
            "ADEQUATE",
          technical_asset_condition:
            "MODERATE"
        },

        llp_forecast: {
          estimated_remaining_cycles: 0,
          estimated_remaining_hours: 0,
          next_major_llp_event_months: 0,
          estimated_llp_replacement_cost_usd: 0,
          llp_consumption_rate:
            "Unknown"
        },

        shop_visit_forecast: {
          estimated_next_shop_visit_months: 0,
          estimated_shop_visit_cost_usd: 0,
          shop_visit_risk:
            "MODERATE",
          key_cost_drivers: []
        },

        maintenance_reserve_forecast: {
          estimated_reserve_balance_usd: 0,
          expected_future_contributions_usd: 0,
          projected_shortfall_usd: 0,
          reserve_risk_level:
            "MODERATE"
        },

        utilization_analysis: {
          utilization_pressure:
            "MODERATE",
          cycle_burn_risk:
            "Fallback response",
          operational_impact:
            "Fallback response"
        },

        lease_end_engine_exposure: {
          lease_return_engine_risk:
            "MODERATE",
          estimated_end_of_lease_liability_usd: 0,
          redelivery_risk_summary:
            "Fallback response"
        },

        strategic_recommendations: [],

        executive_summary:
          "Fallback parsing response"
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "LLP forecasting engine failed:",
      err.message
    );

    throw new Error(
      "LLP forecasting failed"
    );

  }

}

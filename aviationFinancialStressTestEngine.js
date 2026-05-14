import axios from "axios";

/* ===============================
   HYBRID AI CALL
=============================== */

async function callLLM(prompt) {

  try {

    /* ===============================
       MISTRAL FIRST (EUROPEAN PREFERENCE)
    =============================== */

    if (process.env.MISTRAL_API_KEY) {

      const response = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-large-latest",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      return response.data?.choices?.[0]?.message?.content;
    }

    /* ===============================
       OPENAI FALLBACK
    =============================== */

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data?.choices?.[0]?.message?.content;

  } catch (err) {

    console.error("Stress test AI failed:", err.message);

    throw new Error("Aviation stress test failed");

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
   AVIATION FINANCIAL STRESS TEST ENGINE
=============================== */

export async function generateAviationFinancialStressTest({
  contract
}) {

  try {

    const prompt = `
You are a senior aviation CFO risk analyst specializing in airline financial stress testing, fleet economics, and lease exposure.

Simulate financial stress scenarios for this aviation lease contract.

Focus on:

- fuel price shocks
- interest rate increases
- utilization drops
- lease payment stress
- maintenance reserve shortfalls
- currency fluctuations
- recession demand collapse
- fleet grounding risk
- covenant breach probability
- liquidity pressure
- lessor renegotiation risk
- default probability
- return condition financial exposure

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON:

{
  "stress_test_profile": {
    "overall_financial_risk_score": 0,
    "default_probability": "LOW | MODERATE | HIGH | EXTREME",
    "liquidity_pressure": "LOW | MODERATE | HIGH | EXTREME",
    "covenant_breach_risk": "LOW | MODERATE | HIGH | EXTREME"
  },

  "baseline_vs_stress": {
    "baseline_operating_margin_usd": 0,
    "stress_operating_margin_usd": 0,
    "margin_shock_percentage": 0,
    "cash_burn_increase_usd": 0
  },

  "fuel_shock_scenario": {
    "fuel_price_increase_percent": 0,
    "annual_cost_impact_usd": 0,
    "pass_through_capacity": "LOW | MODERATE | HIGH | FULL",
    "profitability_impact": "LOW | MODERATE | HIGH | SEVERE"
  },

  "interest_rate_scenario": {
    "rate_increase_percent": 0,
    "lease_cost_impact_usd": 0,
    "debt_service_pressure": "LOW | MODERATE | HIGH | EXTREME"
  },

  "utilization_shock": {
    "utilization_drop_percent": 0,
    "revenue_impact_usd": 0,
    "fleet_grounding_risk": "LOW | MODERATE | HIGH | EXTREME"
  },

  "maintenance_and_reserve_stress": {
    "reserve_shortfall_usd": 0,
    "unexpected_maintenance_spike_usd": 0,
    "liquidity_drawdown_risk": "LOW | MODERATE | HIGH | EXTREME"
  },

  "currency_exposure": {
    "fx_volatility_impact_usd": 0,
    "hedging_effectiveness": "LOW | MODERATE | HIGH | STRONG"
  },

  "recession_scenario": {
    "revenue_drop_percent": 0,
    "route_network_pressure": "LOW | MODERATE | HIGH | SEVERE",
    "survival_cash_runway_months": 0
  },

  "lease_exposure_risk": {
    "lease_payment_stress": "LOW | MODERATE | HIGH | EXTREME",
    "renegotiation_probability": "LOW | MODERATE | HIGH | EXTREME",
    "return_liability_usd": 0
  },

  "strategic_actions": [
    ""
  ],

  "executive_summary": ""
}

Rules:
- Think like airline CFO + aviation risk officer
- Be realistic, financially grounded
- Use aviation economics logic
- No markdown
- No explanations outside JSON
`;

    const raw = await callLLM(prompt);

    const parsed = safeParse(raw);

    if (!parsed) {

      return {
        stress_test_profile: {
          overall_financial_risk_score: 55,
          default_probability: "MODERATE",
          liquidity_pressure: "MODERATE",
          covenant_breach_risk: "MODERATE"
        },

        baseline_vs_stress: {
          baseline_operating_margin_usd: 0,
          stress_operating_margin_usd: 0,
          margin_shock_percentage: 0,
          cash_burn_increase_usd: 0
        },

        fuel_shock_scenario: {
          fuel_price_increase_percent: 0,
          annual_cost_impact_usd: 0,
          pass_through_capacity: "MODERATE",
          profitability_impact: "MODERATE"
        },

        interest_rate_scenario: {
          rate_increase_percent: 0,
          lease_cost_impact_usd: 0,
          debt_service_pressure: "MODERATE"
        },

        utilization_shock: {
          utilization_drop_percent: 0,
          revenue_impact_usd: 0,
          fleet_grounding_risk: "MODERATE"
        },

        maintenance_and_reserve_stress: {
          reserve_shortfall_usd: 0,
          unexpected_maintenance_spike_usd: 0,
          liquidity_drawdown_risk: "MODERATE"
        },

        currency_exposure: {
          fx_volatility_impact_usd: 0,
          hedging_effectiveness: "MODERATE"
        },

        recession_scenario: {
          revenue_drop_percent: 0,
          route_network_pressure: "MODERATE",
          survival_cash_runway_months: 0
        },

        lease_exposure_risk: {
          lease_payment_stress: "MODERATE",
          renegotiation_probability: "MODERATE",
          return_liability_usd: 0
        },

        strategic_actions: [],

        executive_summary: "Fallback stress test output"
      };

    }

    return parsed;

  } catch (err) {

    console.error("Aviation stress test failed:", err.message);

    throw new Error("Aviation financial stress test failed");

  }

}

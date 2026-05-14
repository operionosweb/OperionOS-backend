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
      "Lease return AI failed:",
      err.message
    );

    throw new Error(
      "Lease return simulation failed"
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
   LEASE RETURN SIMULATOR
=============================== */

export async function generateLeaseReturnSimulation({
  contract
}) {

  try {

    const prompt = `
You are a senior aviation lease return and redelivery specialist.

Analyze this aircraft lease contract and simulate aircraft lease return exposure.

Focus heavily on:
- return conditions
- redelivery obligations
- maintenance reserve reconciliation
- LLP exposure
- engine condition requirements
- airframe return standards
- lessor dispute probability
- cash settlement risk
- return timing pressure
- technical records exposure
- end-of-lease cost forecasting

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON:

{
  "return_profile": {
    "overall_return_risk_score": 0,
    "technical_return_complexity": "LOW | MODERATE | HIGH | EXTREME",
    "lessor_dispute_probability": "LOW | MODERATE | HIGH | EXTREME",
    "cash_settlement_risk": "LOW | MODERATE | HIGH | EXTREME"
  },

  "estimated_return_costs": {
    "airframe_cost_usd": 0,
    "engine_cost_usd": 0,
    "apu_cost_usd": 0,
    "landing_gear_cost_usd": 0,
    "llp_cost_usd": 0,
    "records_reconstruction_cost_usd": 0,
    "paint_livery_cost_usd": 0,
    "total_estimated_return_cost_usd": 0
  },

  "return_condition_findings": [
    {
      "area": "",
      "severity": "LOW | MEDIUM | HIGH | CRITICAL",
      "financial_exposure_usd": 0,
      "issue": "",
      "recommended_action": ""
    }
  ],

  "maintenance_reserve_reconciliation": {
    "estimated_reserve_recovery_usd": 0,
    "estimated_unrecoverable_reserves_usd": 0,
    "reconciliation_risk": "LOW | MODERATE | HIGH | EXTREME",
    "analysis": ""
  },

  "llp_analysis": {
    "llp_exposure_score": 0,
    "estimated_llp_shortfall_usd": 0,
    "llp_risk_summary": ""
  },

  "redelivery_timeline": {
    "estimated_redelivery_duration_days": 0,
    "major_schedule_risks": [
      ""
    ]
  },

  "strategic_recommendations": [
    ""
  ],

  "executive_summary": ""
}

Rules:
- Think like aviation lease return specialist
- Be commercially realistic
- Use real aviation leasing logic
- Focus heavily on return exposure
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {

        return_profile: {
          overall_return_risk_score: 50,
          technical_return_complexity:
            "MODERATE",
          lessor_dispute_probability:
            "MODERATE",
          cash_settlement_risk:
            "MODERATE"
        },

        estimated_return_costs: {
          airframe_cost_usd: 0,
          engine_cost_usd: 0,
          apu_cost_usd: 0,
          landing_gear_cost_usd: 0,
          llp_cost_usd: 0,
          records_reconstruction_cost_usd: 0,
          paint_livery_cost_usd: 0,
          total_estimated_return_cost_usd: 0
        },

        return_condition_findings: [],

        maintenance_reserve_reconciliation: {
          estimated_reserve_recovery_usd: 0,
          estimated_unrecoverable_reserves_usd: 0,
          reconciliation_risk:
            "MODERATE",
          analysis:
            "Fallback parsing response"
        },

        llp_analysis: {
          llp_exposure_score: 50,
          estimated_llp_shortfall_usd: 0,
          llp_risk_summary:
            "Fallback parsing response"
        },

        redelivery_timeline: {
          estimated_redelivery_duration_days: 30,
          major_schedule_risks: []
        },

        strategic_recommendations: [],

        executive_summary:
          "Fallback parsing response"
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Lease return simulator failed:",
      err.message
    );

    throw new Error(
      "Lease return simulation failed"
    );

  }

}

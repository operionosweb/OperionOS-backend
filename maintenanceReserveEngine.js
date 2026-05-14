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
      "Maintenance reserve AI failed:",
      err.message
    );

    throw new Error(
      "Maintenance reserve analysis failed"
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
   MAINTENANCE RESERVE ENGINE
=============================== */

export async function generateMaintenanceReserveAnalysis({
  contract
}) {

  try {

    const prompt = `
You are an aviation maintenance reserve and lease return expert.

Analyze this aircraft lease contract and estimate maintenance reserve exposure, return liabilities, and operational maintenance burden.

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON:

{
  "maintenance_reserve_profile": {
    "overall_exposure_score": 0,
    "reserve_structure_type": "",
    "cashflow_pressure_score": 0,
    "redelivery_burden_score": 0,
    "technical_return_risk_score": 0
  },

  "estimated_reserve_exposure": {
    "airframe_usd": 0,
    "engine_usd": 0,
    "apu_usd": 0,
    "llp_usd": 0,
    "landing_gear_usd": 0,
    "total_estimated_exposure_usd": 0
  },

  "maintenance_reserve_clauses": [
    {
      "clause": "",
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
      "financial_impact_usd": 0,
      "analysis": "",
      "recommended_negotiation": ""
    }
  ],

  "return_condition_analysis": {
    "return_severity": "LOW | MODERATE | HIGH | EXTREME",
    "estimated_return_cost_usd": 0,
    "major_return_risks": [
      ""
    ]
  },

  "llp_exposure_analysis": {
    "llp_risk_score": 0,
    "estimated_llp_exposure_usd": 0,
    "llp_comments": ""
  },

  "executive_summary": "",

  "recommended_actions": [
    ""
  ]
}

Rules:
- Think like senior aviation technical lease management expert
- Focus heavily on reserves, LLPs, redelivery conditions, maintenance return obligations and cash exposure
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
        maintenance_reserve_profile: {
          overall_exposure_score: 50,
          reserve_structure_type:
            "UNKNOWN",
          cashflow_pressure_score: 50,
          redelivery_burden_score: 50,
          technical_return_risk_score: 50
        },

        estimated_reserve_exposure: {
          airframe_usd: 0,
          engine_usd: 0,
          apu_usd: 0,
          llp_usd: 0,
          landing_gear_usd: 0,
          total_estimated_exposure_usd: 0
        },

        maintenance_reserve_clauses: [],

        return_condition_analysis: {
          return_severity:
            "MODERATE",
          estimated_return_cost_usd: 0,
          major_return_risks: []
        },

        llp_exposure_analysis: {
          llp_risk_score: 50,
          estimated_llp_exposure_usd: 0,
          llp_comments:
            "Fallback parsing response"
        },

        executive_summary:
          "Fallback parsing response",

        recommended_actions: []
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Maintenance reserve engine failed:",
      err.message
    );

    throw new Error(
      "Maintenance reserve generation failed"
    );

  }

}

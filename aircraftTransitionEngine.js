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
      "Aircraft transition AI failed:",
      err.message
    );

    throw new Error(
      "Aircraft transition failed"
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
   AIRCRAFT TRANSITION ENGINE
=============================== */

export async function generateAircraftTransition({
  contract
}) {

  try {

    const prompt = `
You are a senior aircraft transition and lease transfer specialist.

Analyze this aviation lease contract and simulate aircraft transition exposure.

Focus heavily on:
- aircraft transition complexity
- lease transfer readiness
- technical records completeness
- export/import exposure
- jurisdictional regulatory risks
- maintenance positioning requirements
- MRO scheduling pressure
- aircraft storage/reactivation economics
- ferry flight planning risk
- transition delays
- lessor coordination exposure
- redelivery logistics
- operational continuity risk

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 25000)}

Return ONLY valid JSON.

{
  "transition_profile": {
    "overall_transition_risk_score": 0,
    "transition_complexity": "LOW | MODERATE | HIGH | EXTREME",
    "technical_transfer_difficulty": "LOW | MODERATE | HIGH | EXTREME",
    "regulatory_risk_level": "LOW | MODERATE | HIGH | EXTREME"
  },

  "timeline_analysis": {
    "estimated_transition_duration_days": 0,
    "critical_transition_path": [
      ""
    ],
    "delay_probability": "LOW | MODERATE | HIGH | EXTREME"
  },

  "technical_records_analysis": {
    "records_completeness_score": 0,
    "missing_documentation_risk": "LOW | MODERATE | HIGH | EXTREME",
    "estimated_records_reconstruction_cost_usd": 0,
    "records_risk_summary": ""
  },

  "maintenance_positioning": {
    "required_maintenance_actions": [
      ""
    ],
    "estimated_positioning_cost_usd": 0,
    "maintenance_readiness": "READY | PARTIAL | HIGH_RISK"
  },

  "storage_and_reactivation": {
    "storage_risk": "LOW | MODERATE | HIGH | EXTREME",
    "estimated_storage_cost_usd": 0,
    "estimated_reactivation_cost_usd": 0,
    "preservation_complexity": ""
  },

  "ferry_and_logistics": {
    "ferry_flight_risk": "LOW | MODERATE | HIGH | EXTREME",
    "estimated_logistics_cost_usd": 0,
    "cross_border_exposure": ""
  },

  "financial_exposure": {
    "estimated_total_transition_cost_usd": 0,
    "unexpected_cost_probability": "LOW | MODERATE | HIGH | EXTREME",
    "primary_cost_drivers": [
      ""
    ]
  },

  "strategic_recommendations": [
    ""
  ],

  "executive_summary": ""
}

Rules:
- Think like aircraft transition manager
- Think like aviation asset manager
- Use realistic aviation operational logic
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

        transition_profile: {
          overall_transition_risk_score: 50,
          transition_complexity:
            "MODERATE",
          technical_transfer_difficulty:
            "MODERATE",
          regulatory_risk_level:
            "MODERATE"
        },

        timeline_analysis: {
          estimated_transition_duration_days: 45,
          critical_transition_path: [],
          delay_probability:
            "MODERATE"
        },

        technical_records_analysis: {
          records_completeness_score: 50,
          missing_documentation_risk:
            "MODERATE",
          estimated_records_reconstruction_cost_usd: 0,
          records_risk_summary:
            "Fallback parsing response"
        },

        maintenance_positioning: {
          required_maintenance_actions: [],
          estimated_positioning_cost_usd: 0,
          maintenance_readiness:
            "PARTIAL"
        },

        storage_and_reactivation: {
          storage_risk:
            "MODERATE",
          estimated_storage_cost_usd: 0,
          estimated_reactivation_cost_usd: 0,
          preservation_complexity:
            "Fallback parsing response"
        },

        ferry_and_logistics: {
          ferry_flight_risk:
            "MODERATE",
          estimated_logistics_cost_usd: 0,
          cross_border_exposure:
            "Fallback parsing response"
        },

        financial_exposure: {
          estimated_total_transition_cost_usd: 0,
          unexpected_cost_probability:
            "MODERATE",
          primary_cost_drivers: []
        },

        strategic_recommendations: [],

        executive_summary:
          "Fallback parsing response"
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Aircraft transition engine failed:",
      err.message
    );

    throw new Error(
      "Aircraft transition failed"
    );

  }

}

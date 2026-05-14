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

      const res = await axios.post(
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

      return res.data.choices?.[0]?.message?.content;
    }

    /* ===============================
       OPENAI FALLBACK
    =============================== */

    const res = await axios.post(
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

    return res.data.choices?.[0]?.message?.content;

  } catch (err) {

    console.error(
      "Risk scoring AI failed:",
      err.message
    );

    throw new Error(
      "Risk scoring generation failed"
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
   MAIN ENGINE
=============================== */

export async function generateRiskScoring({
  contract
}) {
  try {

    const prompt = `
You are an aviation contract risk scoring engine.

Analyze this aircraft lease contract and produce professional weighted aviation risk scores.

CONTRACT SUMMARY:
${contract.summary || ""}

OVERALL RISK:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

{
  "overall_weighted_risk": 0-100,

  "financial_exposure_score": 0-100,
  "maintenance_burden_score": 0-100,
  "operational_flexibility_score": 0-100,
  "redelivery_risk_score": 0-100,
  "penalty_exposure_score": 0-100,
  "lessor_aggressiveness_score": 0-100,

  "risk_grade": "LOW | MODERATE | HIGH | CRITICAL",

  "highest_risk_areas": [
    {
      "category": "",
      "severity": "LOW | MEDIUM | HIGH",
      "reason": ""
    }
  ],

  "financial_risk_summary": "",
  "operational_risk_summary": "",
  "executive_risk_summary": "",

  "recommended_actions": [
    ""
  ]
}

Rules:
- Think like an aviation leasing risk analyst
- Be commercially realistic
- Focus heavily on penalties, maintenance reserves, return conditions, liability and operational constraints
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {
        overall_weighted_risk: 50,
        financial_exposure_score: 50,
        maintenance_burden_score: 50,
        operational_flexibility_score: 50,
        redelivery_risk_score: 50,
        penalty_exposure_score: 50,
        lessor_aggressiveness_score: 50,
        risk_grade: "MODERATE",
        highest_risk_areas: [],
        financial_risk_summary:
          "Fallback parsing response",
        operational_risk_summary: "",
        executive_risk_summary: "",
        recommended_actions: []
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Risk scoring engine error:",
      err.message
    );

    throw new Error(
      "Risk scoring analysis failed"
    );

  }
}

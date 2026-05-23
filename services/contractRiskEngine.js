import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN RISK ENGINE
// ======================================================

export async function analyzeContractRisk(
  clauses,
  obligations
) {

  try {

    // ==================================================
    // MISTRAL FIRST
    // ==================================================

    try {

      const mistral =
        await analyzeWithMistral(
          clauses,
          obligations
        );

      if (
        mistral &&
        mistral.contract_risk_score !== undefined
      ) {

        return mistral;
      }

    } catch (err) {

      console.error(
        "MISTRAL RISK ENGINE ERROR:",
        err.message
      );
    }

    // ==================================================
    // OPENAI SECOND
    // ==================================================

    try {

      const openAI =
        await analyzeWithOpenAI(
          clauses,
          obligations
        );

      if (
        openAI &&
        openAI.contract_risk_score !== undefined
      ) {

        return openAI;
      }

    } catch (err) {

      console.error(
        "OPENAI RISK ENGINE ERROR:",
        err.message
      );
    }

    // ==================================================
    // LOCAL FALLBACK
    // ==================================================

    return localRiskEngine(
      clauses,
      obligations
    );

  } catch (err) {

    console.error(
      "RISK ENGINE FAILURE:",
      err
    );

    return {
      contract_risk_score: 0,
      executive_summary:
        "Risk analysis failed",
      risks: [],
      critical_flags: [
        "analysis_failed"
      ]
    };
  }
}

// ======================================================
// MISTRAL ANALYSIS
// ======================================================

async function analyzeWithMistral(
  clauses,
  obligations
) {

  const response =
    await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model:
          "mistral-small-latest",

        messages: [
          {
            role: "system",

            content: `
You are an enterprise legal AI risk engine.

Analyze:
- liability exposure
- insurance gaps
- termination risks
- compliance issues
- indemnification exposure
- operational obligations
- missing protections

Return ONLY JSON.

{
  "contract_risk_score": 0,
  "executive_summary": "",
  "financial_exposure": "",
  "compliance_exposure": "",
  "operational_risk": "",
  "risks": [],
  "critical_flags": []
}
`
          },

          {
            role: "user",

            content: JSON.stringify({
              clauses,
              obligations
            })
          }
        ],

        temperature: 0.1,

        response_format: {
          type: "json_object"
        }
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

  const raw =
    response.data
      .choices?.[0]
      ?.message?.content;

  return JSON.parse(raw);
}

// ======================================================
// OPENAI ANALYSIS
// ======================================================

async function analyzeWithOpenAI(
  clauses,
  obligations
) {

  const completion =
    await openai.chat.completions.create({

      model:
        "gpt-4.1-mini",

      temperature: 0.1,

      messages: [
        {
          role: "system",

          content: `
You are an enterprise legal AI risk engine.

Analyze:
- liability exposure
- insurance gaps
- termination risks
- compliance issues
- indemnification exposure
- operational obligations
- missing protections

Return ONLY JSON.

{
  "contract_risk_score": 0,
  "executive_summary": "",
  "financial_exposure": "",
  "compliance_exposure": "",
  "operational_risk": "",
  "risks": [],
  "critical_flags": []
}
`
        },

        {
          role: "user",

          content: JSON.stringify({
            clauses,
            obligations
          })
        }
      ],

      response_format: {
        type: "json_object"
      }
    });

  const raw =
    completion.choices?.[0]
      ?.message?.content;

  return JSON.parse(raw);
}

// ======================================================
// LOCAL FALLBACK ENGINE
// ======================================================

function localRiskEngine(
  clauses,
  obligations
) {

  let score = 0;

  const risks = [];

  const criticalFlags = [];

  // ==================================================
  // CLAUSE ANALYSIS
  // ==================================================

  clauses.forEach((clause) => {

    const type =
      (
        clause.clause_type || ""
      ).toLowerCase();

    const text =
      (
        clause.clause_text || ""
      ).toLowerCase();

    // ==============================================
    // LIABILITY
    // ==============================================

    if (
      type.includes("liability")
    ) {

      score += 20;

      risks.push({
        type: "liability",
        severity: "HIGH",
        description:
          "Liability exposure detected"
      });

      if (
        text.includes("unlimited") ||
        text.includes("unlimited liability")
      ) {

        criticalFlags.push(
          "uncapped_liability"
        );

        score += 25;
      }
    }

    // ==============================================
    // INDEMNITY
    // ==============================================

    if (
      text.includes("indemnify") ||
      text.includes("indemnification")
    ) {

      score += 15;

      risks.push({
        type: "indemnity",
        severity: "HIGH",
        description:
          "Indemnification exposure detected"
      });
    }

    // ==============================================
    // TERMINATION
    // ==============================================

    if (
      type.includes("termination")
    ) {

      score += 10;

      risks.push({
        type: "termination",
        severity: "MEDIUM",
        description:
          "Termination clause risk"
      });
    }

    // ==============================================
    // INSURANCE
    // ==============================================

    if (
      type.includes("insurance")
    ) {

      if (
        !text.includes("$") &&
        !text.includes("million")
      ) {

        criticalFlags.push(
          "missing_insurance_limit"
        );

        score += 20;
      }
    }

    // ==============================================
    // COMPLIANCE
    // ==============================================

    if (
      type.includes("compliance")
    ) {

      score += 10;

      risks.push({
        type: "compliance",
        severity: "MEDIUM",
        description:
          "Compliance obligations detected"
      });
    }

  });

  // ==================================================
  // OBLIGATION LOAD
  // ==================================================

  if (
    obligations.length > 15
  ) {

    score += 10;

    criticalFlags.push(
      "high_operational_burden"
    );
  }

  // ==================================================
  // CAP SCORE
  // ==================================================

  if (
    score > 100
  ) {

    score = 100;
  }

  // ==================================================
  // BUILD RESULT
  // ==================================================

  return {

    contract_risk_score:
      score,

    executive_summary:
      buildExecutiveSummary(
        score,
        risks,
        criticalFlags
      ),

    financial_exposure:
      buildFinancialExposure(
        criticalFlags
      ),

    compliance_exposure:
      buildComplianceExposure(
        risks
      ),

    operational_risk:
      obligations.length > 15
        ? "High operational obligation volume detected"
        : "Operational obligation load within acceptable range",

    risks,

    critical_flags:
      criticalFlags
  };
}

// ======================================================
// EXECUTIVE SUMMARY
// ======================================================

function buildExecutiveSummary(
  score,
  risks,
  flags
) {

  let level =
    "LOW";

  if (score >= 70) {
    level = "HIGH";
  } else if (score >= 40) {
    level = "MEDIUM";
  }

  return `
Contract risk level: ${level}.

Detected ${risks.length} material risk indicators.

Critical flags:
${flags.length > 0
  ? flags.join(", ")
  : "none"}.
`;
}

// ======================================================
// FINANCIAL EXPOSURE
// ======================================================

function buildFinancialExposure(
  flags
) {

  if (
    flags.includes(
      "uncapped_liability"
    )
  ) {

    return `
Potential uncapped financial liability exposure detected.
`;
  }

  return `
No major financial exposure indicators detected.
`;
}

// ======================================================
// COMPLIANCE EXPOSURE
// ======================================================

function buildComplianceExposure(
  risks
) {

  const compliance =
    risks.filter(
      (r) =>
        r.type === "compliance"
    );

  if (
    compliance.length > 0
  ) {

    return `
Compliance obligations and regulatory exposure identified.
`;
  }

  return `
No major compliance exposure identified.
`;
}

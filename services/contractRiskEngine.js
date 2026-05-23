import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN ENGINE
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
        "MISTRAL RISK ERROR:",
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
        "OPENAI RISK ERROR:",
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

      executive_summary: {
        overall_assessment:
          "Risk analysis failed",

        key_concerns: [],

        recommended_actions: []
      },

      risks: [],

      critical_flags: [
        "analysis_failed"
      ]
    };
  }
}

// ======================================================
// MISTRAL
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
You are an enterprise aviation and maritime legal AI system.

Analyze:
- liability exposure
- indemnification
- insurance exposure
- operational burden
- compliance risks
- missing protections
- financial exposure
- termination risks

Return ONLY valid JSON.

{
  "contract_risk_score": 0,
  "executive_summary": {
    "overall_assessment": "",
    "key_concerns": [],
    "recommended_actions": []
  },
  "financial_exposure": "",
  "compliance_exposure": "",
  "operational_risk": "",
  "missing_protections": [],
  "risks": [],
  "critical_flags": []
}
`
          },

          {
            role: "user",

            content:
              JSON.stringify({
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
// OPENAI
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
You are an enterprise aviation and maritime legal AI system.

Analyze:
- liability exposure
- indemnification
- insurance exposure
- operational burden
- compliance risks
- missing protections
- financial exposure
- termination risks

Return ONLY valid JSON.

{
  "contract_risk_score": 0,
  "executive_summary": {
    "overall_assessment": "",
    "key_concerns": [],
    "recommended_actions": []
  },
  "financial_exposure": "",
  "compliance_exposure": "",
  "operational_risk": "",
  "missing_protections": [],
  "risks": [],
  "critical_flags": []
}
`
        },

        {
          role: "user",

          content:
            JSON.stringify({
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

  const missingProtections = [];

  const clauseTypes =
    clauses.map((c) =>
      (
        c.clause_type || ""
      ).toLowerCase()
    );

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
        category:
          "liability",

        severity:
          "HIGH",

        issue:
          "Liability exposure detected"
      });

      if (
        text.includes("unlimited")
      ) {

        score += 25;

        criticalFlags.push(
          "uncapped_liability"
        );
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
        category:
          "indemnity",

        severity:
          "HIGH",

        issue:
          "Broad indemnification obligations"
      });

      criticalFlags.push(
        "broad_indemnification"
      );
    }

    // ==============================================
    // TERMINATION
    // ==============================================

    if (
      type.includes("termination")
    ) {

      score += 10;

      risks.push({
        category:
          "termination",

        severity:
          "MEDIUM",

        issue:
          "Termination clause risk detected"
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

        score += 20;

        criticalFlags.push(
          "missing_insurance_limit"
        );
      }
    }

  });

  // ==================================================
  // MISSING PROTECTIONS
  // ==================================================

  if (
    !clauseTypes.some((t) =>
      t.includes("force majeure")
    )
  ) {

    missingProtections.push(
      "force_majeure"
    );

    score += 10;
  }

  if (
    !clauseTypes.some((t) =>
      t.includes("governing")
    )
  ) {

    missingProtections.push(
      "governing_law"
    );

    score += 10;
  }

  if (
    !clauseTypes.some((t) =>
      t.includes("insurance")
    )
  ) {

    missingProtections.push(
      "insurance_clause"
    );

    score += 15;
  }

  // ==================================================
  // OPERATIONAL BURDEN
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
  // EXECUTIVE SUMMARY
  // ==================================================

  const executiveSummary = {

    overall_assessment:
      buildAssessment(score),

    key_concerns:
      buildConcerns(
        risks,
        criticalFlags,
        missingProtections
      ),

    recommended_actions:
      buildRecommendations(
        criticalFlags,
        missingProtections
      )
  };

  // ==================================================
  // FINAL RESULT
  // ==================================================

  return {

    contract_risk_score:
      score,

    executive_summary:
      executiveSummary,

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

    missing_protections:
      missingProtections,

    risks,

    critical_flags:
      criticalFlags
  };
}

// ======================================================
// HELPERS
// ======================================================

function buildAssessment(score) {

  if (score >= 70) {

    return "High contractual risk exposure detected.";
  }

  if (score >= 40) {

    return "Moderate contractual risk exposure detected.";
  }

  return "Low contractual risk exposure detected.";
}

function buildConcerns(
  risks,
  flags,
  missing
) {

  const concerns = [];

  risks.forEach((r) => {
    concerns.push(r.issue);
  });

  flags.forEach((f) => {
    concerns.push(f);
  });

  missing.forEach((m) => {
    concerns.push(
      `Missing protection: ${m}`
    );
  });

  return concerns.slice(0, 10);
}

function buildRecommendations(
  flags,
  missing
) {

  const recommendations = [];

  if (
    flags.includes(
      "uncapped_liability"
    )
  ) {

    recommendations.push(
      "Negotiate liability caps"
    );
  }

  if (
    flags.includes(
      "missing_insurance_limit"
    )
  ) {

    recommendations.push(
      "Define minimum insurance coverage limits"
    );
  }

  if (
    missing.includes(
      "force_majeure"
    )
  ) {

    recommendations.push(
      "Add force majeure protections"
    );
  }

  if (
    missing.includes(
      "governing_law"
    )
  ) {

    recommendations.push(
      "Define governing law and jurisdiction"
    );
  }

  return recommendations;
}

function buildFinancialExposure(
  flags
) {

  if (
    flags.includes(
      "uncapped_liability"
    )
  ) {

    return "Potential uncapped financial exposure identified.";
  }

  return "No major financial exposure identified.";
}

function buildComplianceExposure(
  risks
) {

  const compliance =
    risks.filter(
      (r) =>
        r.category ===
        "compliance"
    );

  if (
    compliance.length > 0
  ) {

    return "Compliance obligations and regulatory exposure identified.";
  }

  return "No major compliance exposure identified.";
        }

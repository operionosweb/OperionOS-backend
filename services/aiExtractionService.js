// services/aiExtractionService.js

/**
 * OPERION OS
 * AI Extraction & Contract Intelligence Engine
 *
 * Responsibilities:
 * - Raw contract text analysis
 * - AI clause extraction
 * - Obligation detection
 * - Risk scoring
 * - Executive summary generation
 * - Compliance detection
 * - Supplier intelligence
 * - Dynamic contract intelligence
 *
 * FULL ESM VERSION
 */

import OpenAI from "openai";

/**
 * OpenAI Client
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * MAIN ENTRY POINT
 * -----------------------------------------
 */

export async function analyzeContractText(
  contractText = "",
  metadata = {}
) {
  try {
    if (!contractText) {
      throw new Error(
        "Contract text is required"
      );
    }

    /**
     * STEP 1
     * Extract structured intelligence
     */
    const extraction =
      await extractStructuredData(
        contractText
      );

    /**
     * STEP 2
     * Calculate risk scoring
     */
    const riskAnalysis =
      calculateRiskAnalysis(
        extraction
      );

    /**
     * STEP 3
     * Build executive summary
     */
    const executiveSummary =
      generateExecutiveSummary(
        extraction,
        riskAnalysis
      );

    /**
     * STEP 4
     * Build final payload
     */
    return {
      success: true,

      contract_name:
        metadata?.filename ||
        "Uploaded Contract",

      executive_summary:
        executiveSummary,

      supplier_name:
        extraction.supplier_name,

      contract_type:
        extraction.contract_type,

      effective_date:
        extraction.effective_date,

      expiry_date:
        extraction.expiry_date,

      value:
        extraction.contract_value,

      risk_score:
        riskAnalysis.overall_risk_score,

      risk_level:
        riskAnalysis.risk_level,

      clauses:
        extraction.clauses,

      obligations:
        extraction.obligations,

      detected_compliance:
        extraction.detected_compliance,

      missing_protections:
        riskAnalysis.missing_protections,

      abnormal_terms:
        riskAnalysis.abnormal_terms,

      operational_burden_score:
        riskAnalysis.operational_burden_score,

      financial_risk_score:
        riskAnalysis.financial_risk_score,

      compliance_risk_score:
        riskAnalysis.compliance_risk_score,

      supplier_risk_score:
        riskAnalysis.supplier_risk_score,
    };
  } catch (error) {
    console.error(
      "analyzeContractText() Error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "AI extraction failed",
    };
  }
}

/**
 * -----------------------------------------
 * AI STRUCTURED EXTRACTION
 * -----------------------------------------
 */

async function extractStructuredData(
  contractText
) {
  try {
    const prompt = `
You are an elite aviation and enterprise legal AI system.

Analyze the following contract and return STRICT JSON.

Required JSON structure:

{
  "supplier_name": "",
  "contract_type": "",
  "effective_date": "",
  "expiry_date": "",
  "contract_value": 0,

  "clauses": [
    {
      "clause_title": "",
      "clause_type": "",
      "risk_level": "",
      "summary": "",
      "clause_text": ""
    }
  ],

  "obligations": [
    {
      "title": "",
      "description": "",
      "severity": "",
      "deadline": ""
    }
  ],

  "detected_compliance": [],
  "key_risks": [],
  "missing_protections": []
}

CONTRACT:
${contractText.substring(0, 15000)}
`;

    const completion =
      await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",

          temperature: 0.2,

          messages: [
            {
              role: "system",
              content:
                "You are a legal AI contract analysis engine. Always return valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }
      );

    const raw =
      completion.choices?.[0]
        ?.message?.content || "{}";

    return safeJsonParse(raw);
  } catch (error) {
    console.error(
      "extractStructuredData() Error:",
      error
    );

    return fallbackExtraction(
      contractText
    );
  }
}

/**
 * -----------------------------------------
 * RISK ANALYSIS ENGINE
 * -----------------------------------------
 */

function calculateRiskAnalysis(
  extraction = {}
) {
  const clauses =
    extraction?.clauses || [];

  const obligations =
    extraction?.obligations || [];

  let riskScore = 0;

  let complianceRisk = 0;

  let abnormalTerms = [];

  /**
   * Missing protections
   */
  const protections = {
    insurance: false,
    indemnity: false,
    limitation_of_liability: false,
    termination: false,
    confidentiality: false,
  };

  for (const clause of clauses) {
    const type =
      normalizeClauseType(
        clause?.clause_type || ""
      );

    /**
     * Protection detection
     */
    if (protections[type] !== undefined) {
      protections[type] = true;
    }

    /**
     * Risk scoring
     */
    switch (
      (clause?.risk_level || "")
        .toLowerCase()
    ) {
      case "critical":
        riskScore += 25;
        break;

      case "high":
        riskScore += 15;
        break;

      case "medium":
        riskScore += 8;
        break;

      default:
        riskScore += 3;
    }

    /**
     * High-risk terms
     */
    const text = (
      clause?.clause_text || ""
    ).toLowerCase();

    if (
      text.includes(
        "unlimited liability"
      ) ||
      text.includes(
        "uncapped liability"
      ) ||
      text.includes(
        "without limitation"
      )
    ) {
      abnormalTerms.push({
        severity: "Critical",
        reason:
          "Uncapped liability exposure",
      });

      riskScore += 25;
    }

    /**
     * Compliance
     */
    if (
      text.includes("gdpr") ||
      text.includes("faa") ||
      text.includes("easa") ||
      text.includes("imo")
    ) {
      complianceRisk += 15;
    }
  }

  /**
   * Missing protections increase risk
   */
  const missingProtections =
    Object.entries(protections)
      .filter(([_, present]) => !present)
      .map(([key]) => key);

  riskScore +=
    missingProtections.length * 8;

  /**
   * Obligation burden
   */
  const operationalBurden =
    Math.min(
      100,
      obligations.length * 6
    );

  riskScore += Math.min(
    20,
    obligations.length * 2
  );

  /**
   * Financial exposure
   */
  const contractValue = Number(
    extraction?.contract_value || 0
  );

  let financialRisk = 20;

  if (contractValue >= 10000000) {
    financialRisk = 90;
    riskScore += 20;
  } else if (
    contractValue >= 5000000
  ) {
    financialRisk = 75;
    riskScore += 15;
  } else if (
    contractValue >= 1000000
  ) {
    financialRisk = 50;
    riskScore += 10;
  }

  /**
   * Final normalization
   */
  riskScore = Math.min(
    100,
    Math.round(riskScore)
  );

  return {
    overall_risk_score:
      riskScore,

    risk_level:
      determineRiskLevel(riskScore),

    compliance_risk_score:
      Math.min(100, complianceRisk),

    operational_burden_score:
      operationalBurden,

    financial_risk_score:
      financialRisk,

    supplier_risk_score:
      riskScore,

    abnormal_terms:
      abnormalTerms,

    missing_protections:
      missingProtections,
  };
}

/**
 * -----------------------------------------
 * EXECUTIVE SUMMARY
 * -----------------------------------------
 */

function generateExecutiveSummary(
  extraction,
  risk
) {
  return `
OPERION AI completed full contract intelligence analysis.

Contract Type:
${extraction?.contract_type || "Unknown"}

Supplier:
${extraction?.supplier_name || "Unknown"}

Overall Risk Score:
${risk?.overall_risk_score || 0}/100

Risk Level:
${risk?.risk_level || "Low"}

Detected Clauses:
${
  extraction?.clauses?.length || 0
}

Detected Obligations:
${
  extraction?.obligations?.length || 0
}

Missing Protections:
${
  risk?.missing_protections
    ?.join(", ") || "None"
}

Compliance Exposure:
${
  extraction?.detected_compliance?.join(
    ", "
  ) || "None"
}

Operational burden and liability exposure have been analyzed successfully.
`.trim();
}

/**
 * -----------------------------------------
 * FALLBACK EXTRACTION
 * -----------------------------------------
 */

function fallbackExtraction(
  contractText
) {
  return {
    supplier_name:
      detectSupplier(contractText),

    contract_type:
      detectContractType(
        contractText
      ),

    effective_date: null,

    expiry_date: null,

    contract_value: 0,

    clauses: basicClauseDetection(
      contractText
    ),

    obligations: [],

    detected_compliance:
      detectCompliance(
        contractText
      ),

    key_risks: [],

    missing_protections: [],
  };
}

/**
 * -----------------------------------------
 * BASIC CLAUSE DETECTION
 * -----------------------------------------
 */

function basicClauseDetection(
  text = ""
) {
  const clauses = [];

  const normalized =
    text.toLowerCase();

  const mappings = [
    {
      keyword: "insurance",
      type: "insurance",
    },
    {
      keyword: "indemnity",
      type: "indemnity",
    },
    {
      keyword: "liability",
      type:
        "limitation_of_liability",
    },
    {
      keyword: "termination",
      type: "termination",
    },
    {
      keyword: "confidential",
      type: "confidentiality",
    },
  ];

  for (const mapping of mappings) {
    if (
      normalized.includes(
        mapping.keyword
      )
    ) {
      clauses.push({
        clause_title:
          mapping.type,

        clause_type:
          mapping.type,

        risk_level: "Medium",

        summary: `${mapping.type} clause detected`,

        clause_text:
          extractRelevantText(
            text,
            mapping.keyword
          ),
      });
    }
  }

  return clauses;
}

/**
 * -----------------------------------------
 * HELPERS
 * -----------------------------------------
 */

function normalizeClauseType(
  type = ""
) {
  return type
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

function determineRiskLevel(score) {
  if (score < 25) return "Low";

  if (score < 50)
    return "Medium";

  if (score < 75)
    return "High";

  return "Critical";
}

function detectCompliance(
  text = ""
) {
  const normalized =
    text.toLowerCase();

  const frameworks = [];

  if (
    normalized.includes("gdpr")
  ) {
    frameworks.push("GDPR");
  }

  if (
    normalized.includes("faa")
  ) {
    frameworks.push("FAA");
  }

  if (
    normalized.includes("easa")
  ) {
    frameworks.push("EASA");
  }

  if (
    normalized.includes("imo")
  ) {
    frameworks.push("IMO");
  }

  return frameworks;
}

function detectSupplier(
  text = ""
) {
  const lines =
    text.split("\n");

  for (const line of lines) {
    if (
      line
        .toLowerCase()
        .includes("between")
    ) {
      return line.trim();
    }
  }

  return "Unknown Supplier";
}

function detectContractType(
  text = ""
) {
  const normalized =
    text.toLowerCase();

  if (
    normalized.includes("lease")
  ) {
    return "Lease Agreement";
  }

  if (
    normalized.includes(
      "service agreement"
    )
  ) {
    return "Service Agreement";
  }

  if (
    normalized.includes(
      "nda"
    ) ||
    normalized.includes(
      "non-disclosure"
    )
  ) {
    return "NDA";
  }

  return "Commercial Contract";
}

function extractRelevantText(
  text,
  keyword
) {
  const index =
    text
      .toLowerCase()
      .indexOf(keyword);

  if (index === -1) {
    return "";
  }

  return text.substring(
    Math.max(0, index - 120),
    Math.min(
      text.length,
      index + 250
    )
  );
}

function safeJsonParse(
  value = "{}"
) {
  try {
    return JSON.parse(value);
  } catch {
    try {
      const cleaned =
        value
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }
    }

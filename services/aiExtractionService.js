// services/contractExtractionEngine.js

/**
 * =========================================
 * OPERION OS
 * ADVANCED CONTRACT EXTRACTION ENGINE
 * =========================================
 */

/**
 * -----------------------------------------
 * SAFE REGEX MATCH
 * -----------------------------------------
 */

function matchFirst(text, regex) {
  const match = text.match(regex);

  return match ? match[1]?.trim() : null;
}

/**
 * -----------------------------------------
 * CLAUSE DETECTION
 * -----------------------------------------
 */

function detectClauses(text = "") {
  const clauses = [];

  const clausePatterns = [
    "termination",
    "liability",
    "indemnification",
    "confidentiality",
    "force majeure",
    "governing law",
    "payment terms",
    "renewal",
    "insurance",
    "warranty",
    "limitation of liability",
    "penalty",
    "breach",
  ];

  const lower = text.toLowerCase();

  for (const clause of clausePatterns) {
    if (lower.includes(clause)) {
      clauses.push(clause);
    }
  }

  return [...new Set(clauses)];
}

/**
 * -----------------------------------------
 * OBLIGATION EXTRACTION
 * -----------------------------------------
 */

function extractObligations(text = "") {
  const obligations = [];

  const lines = text.split("\n");

  for (const line of lines) {
    const l = line.toLowerCase();

    if (
      l.includes("shall") ||
      l.includes("must") ||
      l.includes("required to")
    ) {
      obligations.push(line.trim());
    }

    if (obligations.length >= 25) break;
  }

  return obligations;
}

/**
 * -----------------------------------------
 * PAYMENT TERMS
 * -----------------------------------------
 */

function detectPaymentTerms(text = "") {
  const paymentRegex =
    /payment.{0,50}?(\d{1,3}\s?days)/i;

  return matchFirst(text, paymentRegex);
}

/**
 * -----------------------------------------
 * GOVERNING LAW
 * -----------------------------------------
 */

function detectGoverningLaw(text = "") {
  const governingLawRegex =
    /governed by the laws of\s+([A-Za-z\s]+)/i;

  return matchFirst(text, governingLawRegex);
}

/**
 * -----------------------------------------
 * AUTO RENEWAL DETECTION
 * -----------------------------------------
 */

function detectAutoRenewal(text = "") {
  const lower = text.toLowerCase();

  return (
    lower.includes("auto-renew") ||
    lower.includes("automatic renewal") ||
    lower.includes("automatically renew")
  );
}

/**
 * -----------------------------------------
 * TERMINATION DETECTION
 * -----------------------------------------
 */

function detectTermination(text = "") {
  const lower = text.toLowerCase();

  return (
    lower.includes("termination") ||
    lower.includes("terminate this agreement")
  );
}

/**
 * -----------------------------------------
 * CONTRACT CATEGORY ENGINE
 * -----------------------------------------
 */

function classifyContract(text = "") {
  const lower = text.toLowerCase();

  if (lower.includes("aircraft lease")) {
    return "Aircraft Lease Agreement";
  }

  if (lower.includes("maintenance")) {
    return "Maintenance Agreement";
  }

  if (lower.includes("service level")) {
    return "Service Level Agreement";
  }

  if (lower.includes("nda")) {
    return "Non-Disclosure Agreement";
  }

  if (lower.includes("procurement")) {
    return "Procurement Contract";
  }

  return "General Contract";
}

/**
 * -----------------------------------------
 * RISK ENGINE
 * -----------------------------------------
 */

function calculateRiskScore(text = "") {
  const lower = text.toLowerCase();

  let score = 10;

  const highRiskSignals = [
    "unlimited liability",
    "without limitation",
    "indemnify",
    "penalty",
    "liquidated damages",
    "exclusive",
    "non-cancellable",
    "automatic renewal",
    "termination fee",
  ];

  for (const signal of highRiskSignals) {
    if (lower.includes(signal)) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

/**
 * -----------------------------------------
 * MAIN EXTRACTION ENGINE
 * -----------------------------------------
 */

export async function extractStructuredContractData(
  text = ""
) {
  try {
    return {
      success: true,

      contract_type: classifyContract(text),

      clauses: detectClauses(text),

      obligations: extractObligations(text),

      governing_law: detectGoverningLaw(text),

      payment_terms: detectPaymentTerms(text),

      auto_renewal: detectAutoRenewal(text),

      termination_clause_detected:
        detectTermination(text),

      risk_score: calculateRiskScore(text),
    };
  } catch (error) {
    console.error(
      "contractExtractionEngine error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Structured extraction failed",
    };
  }
}

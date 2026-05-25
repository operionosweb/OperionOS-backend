// services/contractExtractionEngine.js

/**
 * =========================================
 * OPERION OS
 * CONTRACT INTELLIGENCE EXTRACTION ENGINE
 * =========================================
 *
 * PURPOSE:
 * Structured legal + operational extraction
 * layer before AI normalization.
 *
 * FEATURES:
 * - Clause detection
 * - Obligation extraction
 * - Aviation intelligence
 * - Risk signals
 * - Vendor dependency analysis
 * - Compliance signals
 * =========================================
 */

/* ======================================================
   CLAUSE DEFINITIONS
====================================================== */

const CLAUSE_PATTERNS = [
  {
    type: "termination",
    keywords: [
      "termination",
      "terminate",
      "right to terminate",
      "termination for convenience",
    ],
    risk_weight: 12,
  },

  {
    type: "indemnity",
    keywords: [
      "indemnify",
      "indemnification",
      "hold harmless",
    ],
    risk_weight: 15,
  },

  {
    type: "liability",
    keywords: [
      "limitation of liability",
      "unlimited liability",
      "liable",
    ],
    risk_weight: 18,
  },

  {
    type: "confidentiality",
    keywords: [
      "confidential",
      "non-disclosure",
      "nda",
    ],
    risk_weight: 5,
  },

  {
    type: "payment",
    keywords: [
      "payment terms",
      "invoice",
      "fees",
      "pricing",
      "late payment",
    ],
    risk_weight: 8,
  },

  {
    type: "force_majeure",
    keywords: [
      "force majeure",
      "acts of god",
      "unforeseeable events",
    ],
    risk_weight: 7,
  },

  {
    type: "governing_law",
    keywords: [
      "governing law",
      "jurisdiction",
      "court of",
    ],
    risk_weight: 4,
  },

  {
    type: "sla",
    keywords: [
      "service level agreement",
      "uptime",
      "availability",
      "response time",
    ],
    risk_weight: 9,
  },
];

/* ======================================================
   AVIATION CONTRACT SIGNALS
====================================================== */

const AVIATION_SIGNALS = [
  {
    type: "aircraft_lease",
    keywords: [
      "aircraft lease",
      "airframe",
      "lessor",
      "lessee",
    ],
  },

  {
    type: "mro",
    keywords: [
      "maintenance repair overhaul",
      "mro",
      "engine maintenance",
    ],
  },

  {
    type: "fuel_agreement",
    keywords: [
      "fuel supply",
      "jet fuel",
      "fuel vendor",
    ],
  },

  {
    type: "ground_handling",
    keywords: [
      "ground handling",
      "airport services",
      "baggage handling",
    ],
  },

  {
    type: "slot_agreement",
    keywords: [
      "airport slot",
      "slot allocation",
    ],
  },
];

/* ======================================================
   CLAUSE EXTRACTION
====================================================== */

function extractClauses(text = "") {
  const lower = text.toLowerCase();

  const clauses = [];

  for (const clause of CLAUSE_PATTERNS) {
    const matched = clause.keywords.some((k) =>
      lower.includes(k.toLowerCase())
    );

    if (matched) {
      clauses.push({
        type: clause.type,
        detected: true,
        risk_weight: clause.risk_weight,
      });
    }
  }

  return clauses;
}

/* ======================================================
   OBLIGATION EXTRACTION
====================================================== */

function extractObligations(text = "") {
  const obligations = [];

  const patterns = [
    "shall",
    "must",
    "required to",
    "obligated to",
    "responsible for",
  ];

  const sentences = text.split(/[.\n]/);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    const matched = patterns.some((p) =>
      lower.includes(p)
    );

    if (matched) {
      obligations.push(sentence.trim());
    }
  }

  return obligations.slice(0, 25);
}

/* ======================================================
   AVIATION INTELLIGENCE
====================================================== */

function detectAviationSignals(text = "") {
  const lower = text.toLowerCase();

  const detected = [];

  for (const signal of AVIATION_SIGNALS) {
    const matched = signal.keywords.some((k) =>
      lower.includes(k.toLowerCase())
    );

    if (matched) {
      detected.push(signal.type);
    }
  }

  return detected;
}

/* ======================================================
   VENDOR DEPENDENCY DETECTION
====================================================== */

function detectVendorDependency(text = "") {
  const lower = text.toLowerCase();

  const dependencySignals = [
    "exclusive supplier",
    "sole provider",
    "single source",
    "non-cancellable",
    "minimum purchase commitment",
  ];

  let score = 0;

  for (const signal of dependencySignals) {
    if (lower.includes(signal)) {
      score += 20;
    }
  }

  return Math.min(score, 100);
}

/* ======================================================
   RISK ENGINE V2
====================================================== */

function calculateRiskScore({
  clauses = [],
  obligations = [],
  dependencyScore = 0,
}) {
  let risk = 10;

  for (const clause of clauses) {
    risk += clause.risk_weight || 0;
  }

  if (obligations.length > 15) {
    risk += 10;
  }

  risk += dependencyScore;

  return Math.min(risk, 100);
}

/* ======================================================
   MAIN EXTRACTION ENGINE
====================================================== */

export function extractContractIntelligence(
  text = ""
) {
  try {
    if (!text) {
      return {
        success: false,
        error: "No text provided",
      };
    }

    const clauses = extractClauses(text);

    const obligations =
      extractObligations(text);

    const aviationSignals =
      detectAviationSignals(text);

    const dependencyScore =
      detectVendorDependency(text);

    const riskScore =
      calculateRiskScore({
        clauses,
        obligations,
        dependencyScore,
      });

    return {
      success: true,

      intelligence: {
        clauses,
        obligations,
        aviation_signals: aviationSignals,
        vendor_dependency_score:
          dependencyScore,
        calculated_risk_score:
          riskScore,
      },
    };
  } catch (error) {
    console.error(
      "Contract extraction error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Extraction failed",
    };
  }
}

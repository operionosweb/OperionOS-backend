import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// STANDARDIZED LEGAL TAXONOMY
// ======================================================

const CLAUSE_TAXONOMY = {

  LIABILITY: [
    "liability",
    "limitation of liability",
    "damages"
  ],

  INDEMNITY: [
    "indemnity",
    "indemnification",
    "hold harmless"
  ],

  INSURANCE: [
    "insurance",
    "coverage"
  ],

  TERMINATION: [
    "termination",
    "cancel",
    "default"
  ],

  PAYMENT: [
    "payment",
    "fees",
    "financial",
    "rent"
  ],

  MAINTENANCE: [
    "maintenance",
    "repair",
    "inspection"
  ],

  COMPLIANCE: [
    "compliance",
    "regulatory",
    "aviation authority",
    "faa",
    "easa"
  ],

  CONFIDENTIALITY: [
    "confidential",
    "non-disclosure",
    "nda"
  ],

  FORCE_MAJEURE: [
    "force majeure",
    "acts of god"
  ],

  GOVERNING_LAW: [
    "governing law",
    "jurisdiction",
    "venue"
  ],

  OPERATIONAL: [
    "operation",
    "pilot",
    "crew",
    "dispatch"
  ],

  DATA_PROTECTION: [
    "data protection",
    "privacy",
    "gdpr"
  ]
};

// ======================================================
// MAIN ENGINE
// ======================================================

export async function extractClauses(
  text
) {

  try {

    if (
      !text ||
      text.length < 100
    ) {

      return [];
    }

    // ==================================================
    // MISTRAL
    // ==================================================

    try {

      const mistral =
        await extractWithMistral(
          text
        );

      if (
        Array.isArray(mistral) &&
        mistral.length > 0
      ) {

        return normalizeClauses(
          mistral
        );
      }

    } catch (err) {

      console.error(
        "MISTRAL CLAUSE ERROR:",
        err.message
      );
    }

    // ==================================================
    // OPENAI
    // ==================================================

    try {

      const openAI =
        await extractWithOpenAI(
          text
        );

      if (
        Array.isArray(openAI) &&
        openAI.length > 0
      ) {

        return normalizeClauses(
          openAI
        );
      }

    } catch (err) {

      console.error(
        "OPENAI CLAUSE ERROR:",
        err.message
      );
    }

    // ==================================================
    // LOCAL FALLBACK
    // ==================================================

    return normalizeClauses(
      localClauseExtractor(text)
    );

  } catch (err) {

    console.error(
      "CLAUSE EXTRACTION FAILURE:",
      err
    );

    return normalizeClauses(
      localClauseExtractor(text)
    );
  }
}

// ======================================================
// MISTRAL
// ======================================================

async function extractWithMistral(
  text
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
You are an aviation and maritime legal AI system.

Extract ALL major contract clauses.

Return ONLY valid JSON.

{
  "clauses": [
    {
      "clause_title": "",
      "clause_type": "",
      "risk_level": "",
      "summary": "",
      "clause_text": ""
    }
  ]
}
`
          },

          {
            role: "user",

            content:
              text.slice(0, 25000)
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

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// OPENAI
// ======================================================

async function extractWithOpenAI(
  text
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
You are an aviation and maritime legal AI system.

Extract ALL major contract clauses.

Return ONLY valid JSON.

{
  "clauses": [
    {
      "clause_title": "",
      "clause_type": "",
      "risk_level": "",
      "summary": "",
      "clause_text": ""
    }
  ]
}
`
        },

        {
          role: "user",

          content:
            text.slice(0, 25000)
        }
      ],

      response_format: {
        type: "json_object"
      }
    });

  const raw =
    completion.choices?.[0]
      ?.message?.content;

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// NORMALIZATION ENGINE
// ======================================================

function normalizeClauses(
  clauses
) {

  return clauses.map((clause) => {

    const normalizedType =
      classifyClause(
        clause
      );

    const severity =
      calculateSeverity(
        clause,
        normalizedType
      );

    const impact =
      calculateImpact(
        normalizedType
      );

    return {

      clause_title:
        clause.clause_title ||
        "Unnamed Clause",

      clause_type:
        normalizedType,

      original_clause_type:
        clause.clause_type || null,

      risk_level:
        severity,

      impact_level:
        impact,

      summary:
        clause.summary ||
        "",

      clause_text:
        clause.clause_text ||
        "",

      confidence_score:
        calculateConfidence(
          clause,
          normalizedType
        )
    };
  });
}

// ======================================================
// CLASSIFICATION
// ======================================================

function classifyClause(
  clause
) {

  const text = `
    ${clause.clause_title || ""}
    ${clause.clause_text || ""}
    ${clause.summary || ""}
    ${clause.clause_type || ""}
  `.toLowerCase();

  for (
    const [type, keywords]
    of Object.entries(
      CLAUSE_TAXONOMY
    )
  ) {

    for (
      const keyword
      of keywords
    ) {

      if (
        text.includes(keyword)
      ) {

        return type;
      }
    }
  }

  return "GENERAL";
}

// ======================================================
// SEVERITY
// ======================================================

function calculateSeverity(
  clause,
  type
) {

  const text =
    (
      clause.clause_text || ""
    ).toLowerCase();

  if (
    type === "LIABILITY" ||
    type === "INDEMNITY"
  ) {

    return "HIGH";
  }

  if (
    text.includes("unlimited") ||
    text.includes("sole responsibility")
  ) {

    return "HIGH";
  }

  if (
    type === "TERMINATION" ||
    type === "INSURANCE"
  ) {

    return "MEDIUM";
  }

  return "LOW";
}

// ======================================================
// IMPACT
// ======================================================

function calculateImpact(
  type
) {

  switch (type) {

    case "LIABILITY":
    case "INDEMNITY":
      return "CRITICAL";

    case "INSURANCE":
    case "COMPLIANCE":
    case "TERMINATION":
      return "HIGH";

    case "PAYMENT":
    case "MAINTENANCE":
      return "MEDIUM";

    default:
      return "LOW";
  }
}

// ======================================================
// CONFIDENCE
// ======================================================

function calculateConfidence(
  clause,
  type
) {

  const text = `
    ${clause.clause_title || ""}
    ${clause.clause_text || ""}
  `.toLowerCase();

  const keywords =
    CLAUSE_TAXONOMY[type] || [];

  let matches = 0;

  keywords.forEach((k) => {

    if (
      text.includes(k)
    ) {

      matches++;
    }
  });

  return Math.min(
    100,
    50 + (matches * 15)
  );
}

// ======================================================
// LOCAL FALLBACK
// ======================================================

function localClauseExtractor(
  text
) {

  const clauses = [];

  const sections =
    text.split(/ARTICLE\s+\d+/i);

  sections.forEach((section) => {

    if (
      section.trim().length < 100
    ) {

      return;
    }

    const title =
      section
        .split("\n")[0]
        ?.trim()
        ?.slice(0, 80);

    clauses.push({

      clause_title:
        title || "Contract Clause",

      clause_type:
        "GENERAL",

      risk_level:
        "LOW",

      summary:
        section.slice(0, 300),

      clause_text:
        section.slice(0, 3000)
    });
  });

  return clauses;
}

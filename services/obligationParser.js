import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN EXPORT
// ======================================================

export async function extractObligations(clauses) {

  try {

    // ==================================================
    // NORMALIZE TYPES FIRST
    // ==================================================

    const normalizedClauses =
      normalizeClauseTypes(
        clauses
      );

    // ==================================================
    // MISTRAL FIRST
    // ==================================================

    try {

      const mistral =
        await extractWithMistral(
          normalizedClauses
        );

      if (
        mistral &&
        mistral.length > 0
      ) {

        return mistral;
      }

    } catch (err) {

      console.error(
        "MISTRAL OBLIGATION ERROR:",
        err.message
      );
    }

    // ==================================================
    // OPENAI SECOND
    // ==================================================

    try {

      const openAI =
        await extractWithOpenAI(
          normalizedClauses
        );

      if (
        openAI &&
        openAI.length > 0
      ) {

        return openAI;
      }

    } catch (err) {

      console.error(
        "OPENAI OBLIGATION ERROR:",
        err.message
      );
    }

    // ==================================================
    // LOCAL FALLBACK
    // ==================================================

    return localObligationEngine(
      normalizedClauses
    );

  } catch (err) {

    console.error(
      "OBLIGATION ENGINE FAILURE:",
      err
    );

    return [];
  }
}

// ======================================================
// NORMALIZATION ENGINE
// ======================================================

function normalizeClauseTypes(
  clauses
) {

  return clauses.map((clause) => {

    const raw =
      (
        clause.clause_type ||
        ""
      ).toLowerCase();

    let normalized =
      "general";

    // ==========================================
    // PAYMENT
    // ==========================================

    if (
      raw.includes("payment") ||
      raw.includes("rent") ||
      raw.includes("fee")
    ) {

      normalized =
        "payment";
    }

    // ==========================================
    // INSURANCE
    // ==========================================

    else if (
      raw.includes("insurance")
    ) {

      normalized =
        "insurance";
    }

    // ==========================================
    // LIABILITY
    // ==========================================

    else if (
      raw.includes("liability") ||
      raw.includes("indemn")
    ) {

      normalized =
        "liability";
    }

    // ==========================================
    // COMPLIANCE
    // ==========================================

    else if (
      raw.includes("compliance") ||
      raw.includes("regulation")
    ) {

      normalized =
        "compliance";
    }

    // ==========================================
    // TERMINATION
    // ==========================================

    else if (
      raw.includes("termination") ||
      raw.includes("default")
    ) {

      normalized =
        "termination";
    }

    return {
      ...clause,
      clause_type: normalized
    };
  });
}

// ======================================================
// MISTRAL
// ======================================================

async function extractWithMistral(
  clauses
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
Extract contractual obligations.

Return ONLY JSON.

{
  "obligations": []
}
`
          },

          {
            role: "user",

            content:
              JSON.stringify(clauses)
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

  return parsed.obligations || [];
}

// ======================================================
// OPENAI
// ======================================================

async function extractWithOpenAI(
  clauses
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
Extract contractual obligations.

Return ONLY JSON.

{
  "obligations": []
}
`
        },

        {
          role: "user",

          content:
            JSON.stringify(clauses)
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

  return parsed.obligations || [];
}

// ======================================================
// LOCAL FALLBACK ENGINE
// ======================================================

function localObligationEngine(
  clauses
) {

  const obligations = [];

  clauses.forEach((clause) => {

    const type =
      clause.clause_type;

    const text =
      (
        clause.clause_text || ""
      ).toLowerCase();

    // ==========================================
    // PAYMENT
    // ==========================================

    if (
      type === "payment"
    ) {

      obligations.push({

        clause_title:
          clause.clause_title,

        obligation_type:
          "payment",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Payment obligation detected",

        priority:
          "HIGH",

        deadline:
          detectDeadline(text),

        risk_level:
          "HIGH"
      });
    }

    // ==========================================
    // INSURANCE
    // ==========================================

    if (
      type === "insurance"
    ) {

      obligations.push({

        clause_title:
          clause.clause_title,

        obligation_type:
          "insurance",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Insurance obligation detected",

        priority:
          "MEDIUM",

        deadline:
          detectDeadline(text),

        risk_level:
          "MEDIUM"
      });
    }

    // ==========================================
    // COMPLIANCE
    // ==========================================

    if (
      type === "compliance"
    ) {

      obligations.push({

        clause_title:
          clause.clause_title,

        obligation_type:
          "compliance",

        responsible_party:
          detectParty(text),

        obligation_text:
          "Compliance obligation detected",

        priority:
          "HIGH",

        deadline:
          detectDeadline(text),

        risk_level:
          "HIGH"
      });
    }

  });

  return obligations;
}

// ======================================================
// PARTY DETECTION
// ======================================================

function detectParty(text) {

  if (
    text.includes("lessor")
  ) {

    return "Lessor";
  }

  if (
    text.includes("lessee")
  ) {

    return "Lessee";
  }

  if (
    text.includes("club")
  ) {

    return "Club";
  }

  return "Unknown";
}

// ======================================================
// DEADLINE DETECTION
// ======================================================

function detectDeadline(text) {

  const match =
    text.match(
      /within\s+\d+\s+days/i
    );

  if (
    match
  ) {

    return match[0];
  }

  return null;
}

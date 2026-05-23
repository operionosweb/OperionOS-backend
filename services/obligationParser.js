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

export async function extractClauses(contractText) {

  try {

    const cleanedText =
      contractText
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, 30000);

    // ======================================================
    // MISTRAL FIRST
    // ======================================================

    try {

      const mistralResult =
        await extractWithMistral(cleanedText);

      if (
        mistralResult &&
        mistralResult.length > 0
      ) {

        return normalizeClauses(
          mistralResult
        );
      }

    } catch (err) {

      console.error(
        "MISTRAL CLAUSE ERROR:",
        err.message
      );
    }

    // ======================================================
    // OPENAI SECOND
    // ======================================================

    try {

      const openAIResult =
        await extractWithOpenAI(cleanedText);

      if (
        openAIResult &&
        openAIResult.length > 0
      ) {

        return normalizeClauses(
          openAIResult
        );
      }

    } catch (err) {

      console.error(
        "OPENAI CLAUSE ERROR:",
        err.message
      );
    }

    // ======================================================
    // LOCAL FALLBACK
    // ======================================================

    return normalizeClauses(
      localClauseEngine(cleanedText)
    );

  } catch (err) {

    console.error(
      "CLAUSE ENGINE FAILURE:",
      err
    );

    return [];
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
Extract ALL contract clauses.

Return ONLY JSON.

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
            content: text
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
Extract ALL contract clauses.

Return ONLY JSON.

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
          content: text
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

    const rawType =
      (
        clause.clause_type ||
        "general"
      ).toLowerCase();

    let normalizedType =
      "general";

    // ==========================================
    // PARTY
    // ==========================================

    if (
      rawType.includes("part") ||
      rawType.includes("identification")
    ) {

      normalizedType =
        "party_definition";
    }

    // ==========================================
    // PAYMENT
    // ==========================================

    else if (
      rawType.includes("payment") ||
      rawType.includes("rent") ||
      rawType.includes("fee")
    ) {

      normalizedType =
        "payment";
    }

    // ==========================================
    // LIABILITY
    // ==========================================

    else if (
      rawType.includes("liability") ||
      rawType.includes("indemn")
    ) {

      normalizedType =
        "liability";
    }

    // ==========================================
    // TERMINATION
    // ==========================================

    else if (
      rawType.includes("termination") ||
      rawType.includes("default")
    ) {

      normalizedType =
        "termination";
    }

    // ==========================================
    // INSURANCE
    // ==========================================

    else if (
      rawType.includes("insurance")
    ) {

      normalizedType =
        "insurance";
    }

    // ==========================================
    // MAINTENANCE
    // ==========================================

    else if (
      rawType.includes("maintenance") ||
      rawType.includes("repair")
    ) {

      normalizedType =
        "maintenance";
    }

    // ==========================================
    // COMPLIANCE
    // ==========================================

    else if (
      rawType.includes("compliance") ||
      rawType.includes("regulation")
    ) {

      normalizedType =
        "compliance";
    }

    // ==========================================
    // CONFIDENTIALITY
    // ==========================================

    else if (
      rawType.includes("confidential")
    ) {

      normalizedType =
        "confidentiality";
    }

    // ==========================================
    // GOVERNING LAW
    // ==========================================

    else if (
      rawType.includes("governing") ||
      rawType.includes("jurisdiction")
    ) {

      normalizedType =
        "governing_law";
    }

    // ==========================================
    // FORCE MAJEURE
    // ==========================================

    else if (
      rawType.includes("force majeure")
    ) {

      normalizedType =
        "force_majeure";
    }

    return {

      clause_title:
        clause.clause_title ||
        "Unknown Clause",

      clause_type:
        normalizedType,

      risk_level:
        normalizeRisk(
          clause.risk_level
        ),

      summary:
        clause.summary ||
        "",

      clause_text:
        clause.clause_text ||
        ""
    };
  });
}

// ======================================================
// NORMALIZE RISK
// ======================================================

function normalizeRisk(
  risk
) {

  const value =
    (
      risk || "LOW"
    ).toUpperCase();

  if (
    value.includes("HIGH")
  ) {
    return "HIGH";
  }

  if (
    value.includes("MEDIUM")
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

// ======================================================
// LOCAL FALLBACK ENGINE
// ======================================================

function localClauseEngine(
  text
) {

  const clauses = [];

  const regex =
    /(ARTICLE\s+\d+[\s\S]*?)(?=ARTICLE\s+\d+|$)/gi;

  const matches =
    [...text.matchAll(regex)];

  matches.forEach((match) => {

    const article =
      match[0];

    const title =
      article
        .split("\n")[0]
        .trim();

    clauses.push({

      clause_title:
        title,

      clause_type:
        "general",

      risk_level:
        "LOW",

      summary:
        article.slice(0, 300),

      clause_text:
        article.slice(0, 5000)
    });
  });

  return clauses;
}

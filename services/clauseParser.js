import OpenAI from "openai";
import axios from "axios";

// ======================================================
// OPENAI CLIENT
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// MAIN EXPORT
// ======================================================

export async function extractClauses(contractText) {
  try {
    // ======================================================
    // CLEAN INPUT
    // ======================================================

    const cleanedText = contractText
      .replace(/\r/g, "")
      .replace(/\t/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 30000);

    // ======================================================
    // 1. TRY MISTRAL
    // ======================================================

    try {
      console.log("===== TRYING MISTRAL =====");

      const mistralClauses =
        await extractWithMistral(cleanedText);

      if (
        mistralClauses &&
        mistralClauses.length > 0
      ) {
        console.log("✅ MISTRAL SUCCESS");

        return mistralClauses;
      }
    } catch (err) {
      console.error("❌ MISTRAL FAILED");

      console.error(err.message);
    }

    // ======================================================
    // 2. TRY OPENAI
    // ======================================================

    try {
      console.log("===== TRYING OPENAI =====");

      const openAIClauses =
        await extractWithOpenAI(cleanedText);

      if (
        openAIClauses &&
        openAIClauses.length > 0
      ) {
        console.log("✅ OPENAI SUCCESS");

        return openAIClauses;
      }
    } catch (err) {
      console.error("❌ OPENAI FAILED");

      console.error(err.message);
    }

    // ======================================================
    // 3. LOCAL ARTICLE EXTRACTION
    // ======================================================

    console.log(
      "===== USING LOCAL ARTICLE EXTRACTION ====="
    );

    return extractArticles(cleanedText);

  } catch (err) {
    console.error(
      "❌ CLAUSE ENGINE FAILURE"
    );

    console.error(err);

    return [];
  }
}

// ======================================================
// MISTRAL EXTRACTION
// ======================================================

async function extractWithMistral(text) {

  const response =
    await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small-latest",

        messages: [
          {
            role: "system",

            content: `
You are a legal AI engine.

Extract ALL contract clauses.

Return ONLY valid JSON.

FORMAT:

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
    response.data.choices?.[0]?.message?.content;

  console.log("===== MISTRAL RAW =====");

  console.log(raw);

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// OPENAI EXTRACTION
// ======================================================

async function extractWithOpenAI(text) {

  const completion =
    await openai.chat.completions.create({

      model: "gpt-4.1-mini",

      temperature: 0.1,

      messages: [
        {
          role: "system",

          content: `
You are a legal AI engine.

Extract ALL contract clauses.

Return ONLY valid JSON.

FORMAT:

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
    completion.choices?.[0]?.message?.content;

  console.log("===== OPENAI RAW =====");

  console.log(raw);

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// LOCAL ARTICLE EXTRACTION
// ======================================================

function extractArticles(text) {

  const clauses = [];

  // ======================================================
  // MATCH ARTICLES
  // ======================================================

  const articleRegex =
    /(ARTICLE\s+\d+[\s\S]*?)(?=ARTICLE\s+\d+|$)/gi;

  const matches =
    [...text.matchAll(articleRegex)];

  // ======================================================
  // PROCESS ARTICLES
  // ======================================================

  matches.forEach((match, index) => {

    const article =
      match[0].trim();

    if (
      article.length < 100
    ) {
      return;
    }

    const firstLine =
      article
        .split("\n")[0]
        .slice(0, 150);

    const lower =
      article.toLowerCase();

    let clauseType =
      "general";

    let riskLevel =
      "LOW";

    // ======================================================
    // CLAUSE TYPE DETECTION
    // ======================================================

    if (
      lower.includes("termination")
    ) {
      clauseType =
        "termination";

      riskLevel =
        "HIGH";
    }

    else if (
      lower.includes("liability")
    ) {
      clauseType =
        "liability";

      riskLevel =
        "HIGH";
    }

    else if (
      lower.includes("payment")
    ) {
      clauseType =
        "payment";

      riskLevel =
        "HIGH";
    }

    else if (
      lower.includes("insurance")
    ) {
      clauseType =
        "insurance";

      riskLevel =
        "HIGH";
    }

    else if (
      lower.includes("maintenance")
    ) {
      clauseType =
        "maintenance";

      riskLevel =
        "MEDIUM";
    }

    else if (
      lower.includes("compliance") ||
      lower.includes("regulation")
    ) {
      clauseType =
        "compliance";

      riskLevel =
        "HIGH";
    }

    else if (
      lower.includes("confidential")
    ) {
      clauseType =
        "confidentiality";

      riskLevel =
        "HIGH";
    }

    // ======================================================
    // BUILD CLAUSE
    // ======================================================

    clauses.push({

      clause_title:
        firstLine ||
        `Article ${index + 1}`,

      clause_type:
        clauseType,

      risk_level:
        riskLevel,

      summary:
        article.slice(0, 300),

      clause_text:
        article.slice(0, 5000)
    });
  });

  return clauses;
}

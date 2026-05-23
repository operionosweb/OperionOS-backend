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
    // TRY MISTRAL FIRST
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
    // TRY OPENAI SECOND
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
    // LOCAL FALLBACK
    // ======================================================

    console.log(
      "===== USING LOCAL SEMANTIC ENGINE ====="
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
You are an enterprise legal AI system.

Extract ALL contract clauses.

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
You are an enterprise legal AI system.

Extract ALL contract clauses.

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
          content: text
        }
      ],

      response_format: {
        type: "json_object"
      }
    });

  const raw =
    completion.choices?.[0]?.message?.content;

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// LOCAL SEMANTIC ARTICLE EXTRACTION
// ======================================================

function extractArticles(text) {

  const clauses = [];

  // ======================================================
  // ARTICLE MATCHING
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
        .trim()
        .slice(0, 200);

    const lower =
      article.toLowerCase();

    // ======================================================
    // SEMANTIC CLASSIFICATION
    // ======================================================

    const classification =
      classifyClause(
        firstLine,
        lower
      );

    clauses.push({

      clause_title:
        firstLine ||
        `Article ${index + 1}`,

      clause_type:
        classification.type,

      risk_level:
        classification.risk,

      summary:
        article
          .slice(0, 300),

      clause_text:
        article
          .slice(0, 5000)
    });
  });

  return clauses;
}

// ======================================================
// SEMANTIC CLAUSE CLASSIFIER
// ======================================================

function classifyClause(
  title,
  text
) {

  const combined =
    `${title} ${text}`.toLowerCase();

  // ======================================================
  // PARTY DEFINITIONS
  // ======================================================

  if (
    combined.includes("parties") ||
    combined.includes("lessor") ||
    combined.includes("lessee") ||
    combined.includes("club")
  ) {

    return {
      type: "party_definition",
      risk: "LOW"
    };
  }

  // ======================================================
  // DEFINITIONS
  // ======================================================

  if (
    combined.includes("definitions") ||
    combined.includes("defined terms")
  ) {

    return {
      type: "definitions",
      risk: "LOW"
    };
  }

  // ======================================================
  // PAYMENT
  // ======================================================

  if (
    combined.includes("payment") ||
    combined.includes("rent") ||
    combined.includes("fees") ||
    combined.includes("invoice")
  ) {

    return {
      type: "payment",
      risk: "HIGH"
    };
  }

  // ======================================================
  // LIABILITY
  // ======================================================

  if (
    combined.includes

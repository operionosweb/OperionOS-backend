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

  // =========================================
  // LIMIT INPUT SIZE
  // =========================================

  const trimmedText =
    contractText.slice(0, 15000);

  // =========================================
  // 1. TRY MISTRAL FIRST
  // =========================================

  try {

    console.log("===== TRYING MISTRAL =====");

    const mistralResult =
      await extractWithMistral(trimmedText);

    if (
      mistralResult &&
      mistralResult.length > 0
    ) {

      console.log(
        "✅ MISTRAL SUCCESS"
      );

      return mistralResult;
    }

  } catch (err) {

    console.error(
      "❌ MISTRAL FAILED:"
    );

    console.error(err.message);
  }

  // =========================================
  // 2. FALLBACK TO OPENAI
  // =========================================

  try {

    console.log("===== TRYING OPENAI =====");

    const openAIResult =
      await extractWithOpenAI(trimmedText);

    if (
      openAIResult &&
      openAIResult.length > 0
    ) {

      console.log(
        "✅ OPENAI SUCCESS"
      );

      return openAIResult;
    }

  } catch (err) {

    console.error(
      "❌ OPENAI FAILED:"
    );

    console.error(err.message);
  }

  // =========================================
  // 3. LOCAL FALLBACK
  // =========================================

  console.log(
    "===== USING LOCAL PARSER ====="
  );

  return localClauseParser(trimmedText);
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

Extract important contract clauses.

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

  console.log(
    "===== MISTRAL RAW ====="
  );

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

Extract important contract clauses.

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

  console.log(
    "===== OPENAI RAW ====="
  );

  console.log(raw);

  const parsed =
    JSON.parse(raw);

  return parsed.clauses || [];
}

// ======================================================
// LOCAL FALLBACK PARSER
// ======================================================

function localClauseParser(text) {

  const clauses = [];

  const patterns = [

    {
      type: "termination",
      regex:
        /termination|terminate/gi
    },

    {
      type: "liability",
      regex:
        /liability|liable/gi
    },

    {
      type: "payment",
      regex:
        /payment|fees|invoice/gi
    },

    {
      type: "insurance",
      regex:
        /insurance/gi
    },

    {
      type: "confidentiality",
      regex:
        /confidential/gi
    },

    {
      type: "governing_law",
      regex:
        /governing law|jurisdiction/gi
    }
  ];

  patterns.forEach((p) => {

    const found =
      text.match(p.regex);

    if (found) {

      clauses.push({

        clause_title:
          p.type.toUpperCase(),

        clause_type:
          p.type,

        risk_level:
          "MEDIUM",

        summary:
          `${p.type} clause detected`,

        clause_text:
          found[0]
      });
    }
  });

  return clauses;
}

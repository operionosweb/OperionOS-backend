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

export async function extractObligations(
  clauses
) {

  try {

    // ======================================================
    // TRY MISTRAL FIRST
    // ======================================================

    try {

      console.log(
        "===== TRYING MISTRAL OBLIGATIONS ====="
      );

      const mistralResult =
        await extractWithMistral(clauses);

      if (
        mistralResult &&
        mistralResult.length > 0
      ) {

        console.log(
          "✅ MISTRAL OBLIGATIONS SUCCESS"
        );

        return mistralResult;
      }

    } catch (err) {

      console.error(
        "❌ MISTRAL OBLIGATIONS FAILED"
      );

      console.error(err.message);
    }

    // ======================================================
    // TRY OPENAI SECOND
    // ======================================================

    try {

      console.log(
        "===== TRYING OPENAI OBLIGATIONS ====="
      );

      const openAIResult =
        await extractWithOpenAI(clauses);

      if (
        openAIResult &&
        openAIResult.length > 0
      ) {

        console.log(
          "✅ OPENAI OBLIGATIONS SUCCESS"
        );

        return openAIResult;
      }

    } catch (err) {

      console.error(
        "❌ OPENAI OBLIGATIONS FAILED"
      );

      console.error(err.message);
    }

    // ======================================================
    // LOCAL FALLBACK
    // ======================================================

    console.log(
      "===== USING LOCAL OBLIGATION ENGINE ====="
    );

    return extractLocalObligations(clauses);

  } catch (err) {

    console.error(
      "❌ OBLIGATION ENGINE FAILURE"
    );

    console.error(err);

    return [];
  }
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
Extract ALL contractual obligations.

Return ONLY valid JSON.

{
  "obligations": [
    {
      "clause_title": "",
      "obligation_type": "",
      "responsible_party": "",
      "obligation_text": "",
      "priority": "",
      "deadline": "",
      "risk_level": ""
    }
  ]
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
    response.data.choices?.[0]?.message?.content;

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

      model: "gpt-4.1-mini",

      temperature: 0.1,

      messages: [
        {
          role: "system",

          content: `
Extract ALL contractual obligations.

Return ONLY valid JSON.

{
  "obligations": [
    {
      "clause_title": "",
      "obligation_type": "",
      "responsible_party": "",
      "obligation_text": "",
      "priority": "",
      "deadline": "",
      "risk_level": ""
    }
  ]
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
    completion.choices?.[0]?.message?.content;

  const parsed =
    JSON.parse(raw);

  return parsed.obligations || [];
}

// ======================================================
// LOCAL FALLBACK ENGINE
// ======================================================

function extractLocalObligations(
  clauses
) {

  const obligations = [];

  clauses.forEach((clause) => {

    const text =
      (
        clause.clause_text || ""
      ).toLowerCase();

    const title =
      clause.clause_title ||
      "Unknown Clause";

    // ======================================================

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

    // =========================================
    // CLEAN + LIMIT INPUT
    // =========================================

    const cleanedText =
      contractText
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, 25000);

    // =========================================
    // 1. TRY MISTRAL AI
    // =========================================

    try {

      console.log(
        "===== TRYING MISTRAL SEGMENTATION ====="
      );

      const mistralClauses =
        await extractWithMistral(cleanedText);

      if (
        mistralClauses &&
        mistralClauses.length > 0
      ) {

        console.log(
          "✅ MISTRAL SEGMENTATION SUCCESS"
        );

        return mistralClauses;
      }

    } catch (err) {

      console.error(
        "❌ MISTRAL SEGMENTATION FAILED"
      );

      console.error(err.message);
    }

    // =========================================
    // 2. TRY OPENAI
    // =========================================

    try {

      console.log(
        "===== TRYING OPENAI SEGMENTATION ====="
      );

      const openAIClauses =
        await extractWithOpenAI(cleanedText);

      if (
        openAIClauses &&
        openAIClauses.length > 0
      ) {

        console.log(
          "✅ OPENAI SEGMENTATION SUCCESS"
        );

        return openAIClauses;
      }

    } catch (err) {

      console.error(
        "❌ OPENAI SEGMENTATION FAILED"
      );

      console.error(err.message);
    }

    // =========================================
    // 3. LOCAL SEGMENTATION FALLBACK
    // =========================================

    console.log(
      "===== USING LOCAL SEGMENTATION ====="
    );

    return segmentContractLocally(cleanedText);

  } catch (err) {

    console.error(
      "❌ CLAUSE ENGINE FAILED"
    );

    console.error(err);

    return [];
  }
}

// ======================================================
// MISTRAL AI SEGMENTATION
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
You are a legal AI contract analysis engine.

Extract ALL contract clauses.

Each clause must include:
- clause_title
- clause_type
- risk_level
- summary
- clause_text

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
            `Bearer ${process

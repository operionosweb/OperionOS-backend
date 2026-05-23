import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// AI CLAUSE EXTRACTION ENGINE
// ======================================================

export async function extractClauses(contractText) {
  try {

    // =========================================
    // LIMIT INPUT SIZE
    // =========================================

    const trimmedText =
      contractText.slice(0, 12000);

    // =========================================
    // OPENAI REQUEST
    // =========================================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        temperature: 0.1,

        messages: [

          {
            role: "system",

            content: `
You are an elite legal AI contract analysis engine.

Analyze the contract and extract important legal clauses.

Return ONLY valid JSON.

JSON FORMAT:

{
  "clauses": [
    {
      "clause_title": "string",
      "clause_type": "string",
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
      "summary": "short summary",
      "clause_text": "original clause text"
    }
  ]
}

Important:
- Return minimum 5 clauses if found
- Focus on legal importance
- NEVER return markdown
- NEVER explain
- ONLY return valid JSON
`
          },

          {
            role: "user",

            content: trimmedText
          }
        ],

        response_format: {
          type: "json_object"
        }
      });

    // =========================================
    // RAW RESPONSE
    // =========================================

    const raw =
      completion.choices?.[0]?.message?.content;

    console.log(
      "===== GPT RAW RESPONSE ====="
    );

    console.log(raw);

    // =========================================
    // VALIDATE RESPONSE
    // =========================================

    if (!raw) {
      console.error(
        "GPT RETURNED EMPTY RESPONSE"
      );

      return [];
    }

    // =========================================
    // PARSE JSON
    // =========================================

    const parsed =
      JSON.parse(raw);

    // =========================================
    // VALIDATE CLAUSES
    // =========================================

    if (
      !parsed.clauses ||
      !Array.isArray(parsed.clauses)
    ) {

      console.error(
        "INVALID CLAUSE STRUCTURE"
      );

      return [];
    }

    return parsed.clauses;

  } catch (err) {

    console.error(
      "AI CLAUSE EXTRACTION FAILED:"
    );

    console.error(err);

    return [];
  }
}

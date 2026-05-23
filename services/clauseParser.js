import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function extractClauses(contractText) {
  try {
    // =========================================
    // LIMIT HUGE CONTRACTS
    // =========================================

    const trimmedText = contractText.slice(0, 15000);

    // =========================================
    // GPT LEGAL ANALYSIS
    // =========================================

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,

      messages: [
        {
          role: "system",
          content: `
You are an elite legal AI system.

Analyze contracts and extract:

1. Clauses
2. Clause types
3. Legal risks
4. Obligations
5. Liability exposure

Return ONLY valid JSON.

Format:

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

Risk levels:
LOW
MEDIUM
HIGH
CRITICAL
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
    // PARSE GPT RESPONSE
    // =========================================

    const content =
      completion.choices[0].message.content;

    const parsed = JSON.parse(content);

    return parsed.clauses || [];

  } catch (err) {
    console.error(
      "AI CLAUSE EXTRACTION FAILED:",
      err
    );

    return [];
  }
}

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ======================================================
// AI CLAUSE INTELLIGENCE ENGINE
// ======================================================

export async function extractClauses(text) {
  try {
    const prompt = `
You are a legal contract intelligence system for aviation/aircraft lease agreements.

TASK:
1. Split the contract into clauses (Articles/Sections)
2. Classify each clause
3. Extract obligations
4. Detect risk level
5. Summarize meaning

Return STRICT JSON ONLY.

FORMAT:
{
  "clauses": [
    {
      "clause_number": 1,
      "clause_title": "",
      "clause_text": "",
      "clause_type": "payment | termination | insurance | maintenance | liability | notice | general",
      "risk_level": "low | medium | high",
      "summary": "",
      "confidence": 0.0-1.0,
      "obligations": [
        {
          "obligation_text": "",
          "responsible_party": "lessor | lessee | club | unknown",
          "obligation_type": "financial | maintenance | insurance | reporting | operational | general",
          "is_explicit": true,
          "confidence": 0.0-1.0
        }
      ]
    }
  ]
}

CONTRACT:
"""
${text.slice(0, 120000)}
"""
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured legal intelligence from contracts.",
        },
        { role: "user", content: prompt },
      ],
    });

    const data = JSON.parse(response.choices[0].message.content);

    return data.clauses || [];
  } catch (err) {
    console.error("AI CLAUSE EXTRACTION FAILED:", err);

    return [
      {
        clause_number: 1,
        clause_title: "Fallback Clause",
        clause_text: text.slice(0, 5000),
        clause_type: "general",
        risk_level: "unknown",
        summary: "Fallback extraction due to AI failure",
        confidence: 0.1,
        obligations: [],
      },
    ];
  }
}

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractClauses(text) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are a legal contract analysis engine for aviation contracts.

Extract clauses with high precision.

Return ONLY valid JSON in this format:

{
  "clauses": [
    {
      "clause_number": 1,
      "clause_title": "",
      "clause_text": "",
      "clause_type": "payment | liability | termination | maintenance | insurance | operational | legal | other"
    }
  ]
}

Rules:
- Do NOT include explanations
- Do NOT hallucinate clauses
- Keep clause_text exact from document
- Merge small fragments into full clauses
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    return parsed.clauses || [];
  } catch (err) {
    console.error("CLAUSE INTELLIGENCE ERROR:", err);
    return [];
  }
}

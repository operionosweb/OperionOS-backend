import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractObligations(clauses) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Extract obligations from contract clauses.

Return ONLY JSON:

{
  "obligations": [
    {
      "clause_id": 1,
      "obligation_text": "",
      "responsible_party": "lessor | lessee | both | unknown",
      "obligation_type": "payment | maintenance | reporting | compliance | operational | other"
    }
  ]
}
          `,
        },
        {
          role: "user",
          content: JSON.stringify(clauses),
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    return parsed.obligations || [];
  } catch (err) {
    console.error("OBLIGATION INTELLIGENCE ERROR:", err);
    return [];
  }
}

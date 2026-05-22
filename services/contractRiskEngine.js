import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeContractRisk(clauses, obligations) {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are a senior aviation contract risk analyst.

You evaluate aircraft leasing / aviation contracts.

Return ONLY valid JSON:

{
  "contract_risk_score": 0-100,
  "risk_summary": "",
  "risks": [
    {
      "clause_number": 1,
      "risk_type": "financial | legal | operational | compliance | termination | insurance",
      "risk_level": "low | medium | high | critical",
      "risk_score": 0-100,
      "explanation": ""
    }
  ],
  "critical_flags": [
    "string"
  ]
}

Rules:
- Be strict, not optimistic
- Flag ambiguous liability as HIGH
- Flag missing insurance as CRITICAL
- Flag unlimited liability as CRITICAL
- Prefer aviation industry standards
          `,
        },
        {
          role: "user",
          content: JSON.stringify({
            clauses,
            obligations,
          }),
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    return parsed;
  } catch (err) {
    console.error("RISK ENGINE ERROR:", err);

    return {
      contract_risk_score: 0,
      risk_summary: "Risk analysis failed",
      risks: [],
      critical_flags: ["analysis_failed"],
    };
  }
}

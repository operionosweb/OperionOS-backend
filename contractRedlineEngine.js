import axios from "axios";

/* ===============================
   HYBRID AI CALL
=============================== */

async function callLLM(prompt) {

  try {

    /* ===============================
       MISTRAL FIRST
    =============================== */

    if (process.env.MISTRAL_API_KEY) {

      const response =
        await axios.post(
          "https://api.mistral.ai/v1/chat/completions",
          {
            model: "mistral-large-latest",

            messages: [
              {
                role: "user",
                content: prompt
              }
            ],

            temperature: 0.1
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

      return response.data
        .choices?.[0]
        ?.message
        ?.content;
    }

    /* ===============================
       OPENAI FALLBACK
    =============================== */

    const response =
      await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",

          messages: [
            {
              role: "user",
              content: prompt
            }
          ],

          temperature: 0.1
        },
        {
          headers: {
            Authorization:
              `Bearer ${process.env.OPENAI_API_KEY}`,

            "Content-Type":
              "application/json"
          }
        }
      );

    return response.data
      .choices?.[0]
      ?.message
      ?.content;

  } catch (err) {

    console.error(
      "Redline AI failed:",
      err.message
    );

    throw new Error(
      "Redline generation failed"
    );

  }

}

/* ===============================
   SAFE JSON PARSER
=============================== */

function safeParse(text) {

  try {

    return JSON.parse(text);

  } catch {

    return null;

  }

}

/* ===============================
   REDLINE ENGINE
=============================== */

export async function generateContractRedlines({
  contract
}) {

  try {

    const prompt = `
You are an aviation lease negotiation and legal redlining engine.

Analyze the aircraft lease contract and generate negotiation-ready airline-favorable redline recommendations.

CONTRACT SUMMARY:
${contract.summary || ""}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 20000)}

Return ONLY valid JSON:

{
  "overall_negotiation_position": "LOW | MODERATE | AGGRESSIVE",

  "redlines": [
    {
      "clause_title": "",
      "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",

      "original_concern": "",

      "recommended_redline": "",

      "business_impact": "",

      "negotiation_strategy": "",

      "fallback_position": "",

      "airline_favorability_score": 0
    }
  ],

  "highest_priority_redlines": [
    ""
  ],

  "executive_negotiation_summary": "",

  "estimated_financial_protection_usd": 0,

  "recommended_negotiation_order": [
    ""
  ]
}

Rules:
- Think like elite aviation leasing counsel
- Protect airline operational flexibility
- Reduce maintenance reserve exposure
- Reduce penalty exposure
- Reduce aggressive return conditions
- Improve cash flow flexibility
- Be commercially realistic
- No markdown
- No explanations outside JSON
`;

    const raw =
      await callLLM(prompt);

    const parsed =
      safeParse(raw);

    if (!parsed) {

      return {
        overall_negotiation_position:
          "MODERATE",

        redlines: [],

        highest_priority_redlines: [],

        executive_negotiation_summary:
          "Fallback parsing response",

        estimated_financial_protection_usd: 0,

        recommended_negotiation_order: []
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Redline engine failed:",
      err.message
    );

    throw new Error(
      "Contract redline generation failed"
    );

  }

}

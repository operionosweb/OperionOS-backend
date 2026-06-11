import axios from "axios";

/* =========================================
   AI CALL
========================================= */

async function callLLM(prompt) {
  try {

    if (process.env.MISTRAL_API_KEY) {

      const res = await axios.post(
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

      return res.data.choices?.[0]?.message?.content;
    }

    const res = await axios.post(
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

    return res.data.choices?.[0]?.message?.content;

  } catch (err) {

    console.error(
      "Decision chain AI failed:",
      err.message
    );

    throw err;
  }
}

/* =========================================
   SAFE PARSE
========================================= */

function safeParse(text) {

  try {
    return JSON.parse(text);
  } catch {

    try {

      const match =
        text.match(/\[[\s\S]*\]/);

      if (match) {
        return JSON.parse(match[0]);
      }

      return [];

    } catch {
      return [];
    }
  }
}

/* =========================================
   MAIN ENGINE
========================================= */

export async function generateDecisionChain({
  clauses = []
}) {

  const prompt = `
You are an aviation operations intelligence engine.

For each clause create:

1. obligation
2. risk_trigger
3. operational_consequence
4. owner
5. recommendation

Owners MUST be one of:

Technical Services
Finance
Asset Management
Ground Operations
Flight Operations
Compliance
Legal

CLAUSES:

${JSON.stringify(clauses).slice(0,12000)}

Return ONLY JSON array:

[
  {
    "clause":"",

    "obligation":"",

    "risk_trigger":"",

    "operational_consequence":"",

    "owner":"",

    "recommendation":""
  }
]
`;

  const raw =
    await callLLM(prompt);

  const parsed =
    safeParse(raw);

  return parsed;
}

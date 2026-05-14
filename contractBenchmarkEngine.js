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

    /* ===============================
       OPENAI FALLBACK
    =============================== */

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
      "Benchmark AI failed:",
      err.message
    );

    throw new Error(
      "Benchmark AI generation failed"
    );

  }
}

/* ===============================
   SAFE PARSER
=============================== */

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ===============================
   MAIN ENGINE
=============================== */

export async function generateBenchmarkAnalysis({
  contract
}) {
  try {

    const prompt = `
You are an aviation lease benchmarking intelligence engine.

Analyze this airline contract versus typical aviation leasing market standards.

CONTRACT SUMMARY:
${contract.summary || ""}

OVERALL RISK:
${contract.overall_risk || 0}

CLAUSES:
${JSON.stringify(contract.clauses || []).slice(0, 12000)}

Return ONLY valid JSON:

{
  "benchmark_score": 0-100,
  "market_position": "ABOVE_MARKET | MARKET_STANDARD | BELOW_MARKET",
  "estimated_overpayment_percent": 0,
  "aggressive_clauses": [
    {
      "clause": "",
      "severity": "LOW | MEDIUM | HIGH",
      "reason": ""
    }
  ],
  "competitive_advantages": [
    ""
  ],
  "industry_comparison_summary": "",
  "recommended_improvements": [
    ""
  ],
  "financial_impact_summary": "",
  "executive_benchmark_summary": ""
}

Rules:
- Think like a senior aircraft leasing consultant
- Focus on maintenance reserves, redelivery, penalties, liability and operational flexibility
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
        benchmark_score: 50,
        market_position:
          "MARKET_STANDARD",
        estimated_overpayment_percent: 0,
        aggressive_clauses: [],
        competitive_advantages: [],
        industry_comparison_summary:
          "AI parsing fallback",
        recommended_improvements: [],
        financial_impact_summary: "",
        executive_benchmark_summary: ""
      };

    }

    return parsed;

  } catch (err) {

    console.error(
      "Benchmark engine error:",
      err.message
    );

    throw new Error(
      "Benchmark analysis failed"
    );

  }
}

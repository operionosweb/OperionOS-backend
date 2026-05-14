import axios from "axios";

/* ===============================
   MODEL CONFIG
=============================== */

const MISTRAL_API = "https://api.mistral.ai/v1/chat/completions";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";

/* ===============================
   ROUTER LOGIC
=============================== */

function chooseModel(text) {
  const length = text.length;

  // EU-first rule
  if (length < 8000) return "mistral";

  // fallback for heavy context
  return "openai";
}

/* ===============================
   MISTRAL ENGINE (PRIMARY)
=============================== */

async function mistralAnalyze(text) {
  try {
    const response = await axios.post(
      MISTRAL_API,
      {
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content:
              "You are a legal aviation contract intelligence engine. Extract clauses, assess risk, and return structured JSON only."
          },
          {
            role: "user",
            content: `
Analyze this aviation contract:

TEXT:
${text}

Return STRICT JSON format:

{
  "summary": "...",
  "clauses": [
    {
      "title": "",
      "text": "",
      "risk_score": 0-100,
      "risk_reason": ""
    }
  ],
  "overall_risk": 0-100
}
            `
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (err) {
    console.error("Mistral error:", err.message);
    throw err;
  }
}

/* ===============================
   OPENAI FALLBACK
=============================== */

async function openaiAnalyze(text) {
  try {
    const response = await axios.post(
      OPENAI_API,
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a contract analysis engine. Return structured JSON only."
          },
          {
            role: "user",
            content: `
Analyze this contract:

${text}

Return JSON:
{
  "summary": "",
  "clauses": [
    {
      "title": "",
      "text": "",
      "risk_score": 0,
      "risk_reason": ""
    }
  ],
  "overall_risk": 0
}
            `
          }
        ],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI error:", err.message);
    throw err;
  }
}

/* ===============================
   MAIN ENGINE
=============================== */

export async function analyzeContract(text) {
  const model = chooseModel(text);

  try {
    if (model === "mistral") {
      return await mistralAnalyze(text);
    }

    return await openaiAnalyze(text);
  } catch (err) {
    console.warn("Primary model failed, switching fallback...");

    // HARD FALLBACK
    return await openaiAnalyze(text);
  }
}

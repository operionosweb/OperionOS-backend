import axios from "axios";
import { logAudit } from "./db.js";

/* ===============================
   CONFIG
=============================== */

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ===============================
   SAFE FALLBACK
=============================== */

function fallbackExtraction(text) {
  return {
    clauses: [
      {
        type: "GENERAL",
        summary: "Fallback extraction used",
        risk: 50
      }
    ],
    risk_score: 50
  };
}

/* ===============================
   MISTRAL PRIMARY ENGINE (EU)
=============================== */

async function callMistral(contractText) {
  const response = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-large-latest",
      messages: [
        {
          role: "system",
          content:
            "You are an aviation contract analysis system. Return ONLY valid JSON."
        },
        {
          role: "user",
          content: `
Extract contract intelligence.

Return ONLY JSON in this format:

{
  "clauses": [
    {
      "type": "PAYMENT | LIABILITY | TERMINATION | DURATION | DELIVERY | OTHER",
      "summary": "short explanation",
      "risk": 0-100
    }
  ],
  "risk_score": 0-100
}

Contract:
"""
${contractText}
"""
`
        }
      ],
      temperature: 0.2
    },
    {
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  return JSON.parse(content);
}

/* ===============================
   OPENAI FALLBACK ENGINE (PRECISION LAYER)
=============================== */

async function callOpenAI(contractText) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You extract structured aviation contract intelligence. Output ONLY valid JSON."
        },
        {
          role: "user",
          content: `
Return ONLY JSON:

{
  "clauses": [
    {
      "type": "PAYMENT | LIABILITY | TERMINATION | DURATION | DELIVERY | OTHER",
      "summary": "short explanation",
      "risk": 0-100
    }
  ],
  "risk_score": 0-100
}

Contract:
"""
${contractText}
"""
`
        }
      ],
      temperature: 0.1
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  return JSON.parse(content);
}

/* ===============================
   MAIN HYBRID ENGINE
=============================== */

export async function extractContract(req, res) {
  try {
    const { contract_text, file_id, company_id } = req.body;

    if (!contract_text) {
      return res.status(400).json({
        error: "contract_text is required"
      });
    }

    let result;

    /* ===============================
       1. TRY MISTRAL FIRST (EU PRIMARY)
    =============================== */

    try {
      result = await callMistral(contract_text);
    } catch (mistralErr) {
      console.error("Mistral failed, switching to OpenAI:", mistralErr.message);

      /* ===============================
         2. FALLBACK TO OPENAI (PRECISION LAYER)
      =============================== */

      try {
        result = await callOpenAI(contract_text);
      } catch (openaiErr) {
        console.error("OpenAI also failed:", openaiErr.message);

        result = fallbackExtraction(contract_text);
      }
    }

    /* ===============================
       AUDIT LOG
    =============================== */

    await logAudit({
      user_id: req.user?.id || null,
      company_id,
      action: "CONTRACT_AI_HYBRID_EXTRACTED",
      entity_type: "contract",
      entity_id: file_id || null,
      metadata: {
        risk_score: result.risk_score,
        clause_count: result.clauses?.length || 0,
        engine_used:
          result.source || "mistral->openai->fallback"
      }
    });

    /* ===============================
       RESPONSE
    =============================== */

    res.json({
      success: true,
      file_id,
      risk_score: result.risk_score,
      clauses: result.clauses,
      summary: {
        total_clauses: result.clauses.length,
        risk_level:
          result.risk_score > 70
            ? "HIGH"
            : result.risk_score > 40
            ? "MEDIUM"
            : "LOW"
      }
    });

  } catch (err) {
    console.error("Hybrid contract engine error:", err);

    res.status(500).json({
      error: "Contract extraction failed"
    });
  }
}

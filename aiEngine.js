import axios from "axios";
import { logAudit } from "./db.js";

/* ===============================
   GPT CONTRACT INTELLIGENCE ENGINE
   (production-safe version)
=============================== */

function fallbackExtraction(text) {
  return [
    {
      clause_type: "GENERAL",
      content: "Fallback extraction used (AI unavailable)",
      confidence: 0.4
    }
  ];
}

/* ===============================
   GPT CALL
=============================== */

async function callGPT(contractText) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const prompt = `
You are an aviation contract intelligence system.

Extract key clauses from this contract and return ONLY valid JSON in this format:

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
`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You extract structured contract intelligence." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  return JSON.parse(content);
}

/* ===============================
   MAIN CONTRACT EXTRACTOR
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

    try {
      result = await callGPT(contract_text);
    } catch (aiErr) {
      console.error("GPT failed, using fallback:", aiErr.message);

      result = {
        clauses: fallbackExtraction(contract_text),
        risk_score: 50
      };
    }

    // ===============================
    // AUDIT LOG
    // ===============================

    await logAudit({
      user_id: req.user?.id || null,
      company_id,
      action: "CONTRACT_AI_EXTRACTED",
      entity_type: "contract",
      entity_id: file_id || null,
      metadata: {
        risk_score: result.risk_score,
        clause_count: result.clauses?.length || 0
      }
    });

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
    console.error("Contract engine error:", err);

    res.status(500).json({
      error: "Contract extraction failed"
    });
  }
}

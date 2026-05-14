import axios from "axios";
import { logAudit } from "./db.js";

/* ===============================
   SIMPLE AI EXTRACTION ENGINE
   (starter version - safe + upgradeable)
=============================== */

function extractClauses(text) {
  if (!text) return [];

  const clauses = [];

  const patterns = [
    { type: "PAYMENT", keyword: "payment" },
    { type: "TERMINATION", keyword: "termination" },
    { type: "LIABILITY", keyword: "liability" },
    { type: "DURATION", keyword: "term" },
    { type: "DELIVERY", keyword: "delivery" }
  ];

  for (const p of patterns) {
    if (text.toLowerCase().includes(p.keyword)) {
      clauses.push({
        clause_type: p.type,
        content: `Detected ${p.type} clause`,
        confidence: 0.72
      });
    }
  }

  return clauses;
}

/* ===============================
   MAIN CONTRACT PROCESSOR
=============================== */

export async function extractContract(req, res) {
  try {
    const { contract_text, file_id, company_id } = req.body;

    if (!contract_text) {
      return res.status(400).json({
        error: "contract_text is required"
      });
    }

    // 1. Extract clauses
    const clauses = extractClauses(contract_text);

    // 2. Simulated risk scoring
    const risk_score = Math.min(
      100,
      clauses.length * 18 + Math.random() * 10
    );

    // 3. Store extraction log (AI pipeline trace)
    await logAudit({
      user_id: req.user?.id || null,
      company_id,
      action: "CONTRACT_EXTRACTED",
      entity_type: "contract",
      entity_id: file_id || null,
      metadata: {
        clauses_found: clauses.length,
        risk_score
      }
    });

    // 4. Return structured AI output
    res.json({
      success: true,
      file_id,
      risk_score,
      clauses,
      summary: {
        total_clauses: clauses.length,
        risk_level:
          risk_score > 70
            ? "HIGH"
            : risk_score > 40
            ? "MEDIUM"
            : "LOW"
      }
    });

  } catch (err) {
    console.error("Contract extraction error:", err);
    res.status(500).json({
      error: "Contract extraction failed"
    });
  }
}

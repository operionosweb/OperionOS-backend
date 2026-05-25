// services/contractIngestionEngine.js

import crypto from "crypto";
import { detectDocumentType } from "./sharedContractUtils.js";

/**
 * =========================================
 * OPERION OS - CONTRACT INGESTION ENGINE
 * EU AUDIT + DEDUP + CLASSIFICATION LAYER
 * =========================================
 */

/**
 * -----------------------------------------
 * HASH GENERATION (DEDUP CORE)
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * LIGHTWEIGHT RISK SCORING
 * -----------------------------------------
 */

function preRiskScore(text = "") {
  const t = text.toLowerCase();

  let score = 10;

  const signals = [
    "unlimited liability",
    "indemnify",
    "termination",
    "penalty",
    "breach",
    "liquidated damages",
    "without limitation",
    "exclusive",
    "non-cancellable"
  ];

  for (const s of signals) {
    if (t.includes(s)) score += 6;
  }

  return Math.min(100, score);
}

/**
 * -----------------------------------------
 * AUDIT EVENT CREATION (EU COMPLIANCE)
 * -----------------------------------------
 */

function createAuditEvent({ filename, fileId, documentHash, type }) {
  return {
    event_type: "contract_ingested",
    timestamp: new Date().toISOString(),
    filename,
    file_id: fileId,
    document_hash: documentHash,
    detected_type: type,
    region: "EU",
    compliance: "GDPR_READY"
  };
}

/**
 * -----------------------------------------
 * MAIN INGESTION PIPELINE
 * -----------------------------------------
 */

export async function ingestContract({
  text,
  filename = "unknown.pdf",
  fileId = null
}) {
  try {
    if (!text) {
      return {
        success: false,
        error: "No contract text provided"
      };
    }

    const documentHash = generateHash(text);

    const contractType = detectDocumentType(text);
    const riskScore = preRiskScore(text);

    const auditEvent = createAuditEvent({
      filename,
      fileId,
      documentHash,
      type: contractType
    });

    return {
      success: true,
      document_hash: documentHash,
      contract_type: contractType,
      pre_risk_score: riskScore,
      audit_event: auditEvent
    };

  } catch (error) {
    console.error("Ingestion error:", error);

    return {
      success: false,
      error: error.message || "Ingestion failed"
    };
  }
}

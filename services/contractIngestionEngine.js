// services/contractIngestionEngine.js

import crypto from "crypto";

/**
 * =========================================
 * OPERION OS
 * CONTRACT INGESTION ENGINE
 * STABLE VERSION (NO EXTERNAL DEPENDENCIES)
 * =========================================
 */

/**
 * -----------------------------------------
 * HASH GENERATION
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * DOCUMENT TYPE DETECTION
 * -----------------------------------------
 */

function detectDocumentType(text = "") {
  const t = text.toLowerCase();

  if (t.includes("aircraft lease")) {
    return "Aircraft Lease Agreement";
  }

  if (t.includes("maintenance agreement")) {
    return "Maintenance Agreement";
  }

  if (t.includes("service level")) {
    return "Service Level Agreement";
  }

  if (t.includes("procurement")) {
    return "Procurement Contract";
  }

  if (t.includes("purchase order")) {
    return "Purchase Order";
  }

  if (t.includes("nda")) {
    return "Non-Disclosure Agreement";
  }

  return "General Contract";
}

/**
 * -----------------------------------------
 * LIGHTWEIGHT RISK ENGINE
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
    "non-cancellable",
    "automatic renewal",
    "governing law"
  ];

  for (const signal of signals) {
    if (t.includes(signal)) {
      score += 6;
    }
  }

  return Math.min(100, score);
}

/**
 * -----------------------------------------
 * AUDIT EVENT
 * -----------------------------------------
 */

function createAuditEvent({
  filename,
  fileId,
  documentHash,
  contractType
}) {
  return {
    event_type: "contract_ingested",

    timestamp: new Date().toISOString(),

    filename,

    file_id: fileId,

    document_hash: documentHash,

    detected_type: contractType,

    region: "EU",

    compliance: "GDPR_READY"
  };
}

/**
 * =========================================
 * MAIN INGESTION PIPELINE
 * =========================================
 */

export async function ingestContract({
  text,
  filename = "unknown.pdf",
  fileId = null
}) {
  try {
    if (!text || typeof text !== "string") {
      return {
        success: false,
        error: "No valid contract text provided"
      };
    }

    /**
     * -----------------------------------------
     * HASH
     * -----------------------------------------
     */

    const documentHash = generateHash(text);

    /**
     * -----------------------------------------
     * TYPE DETECTION
     * -----------------------------------------
     */

    const contractType =
      detectDocumentType(text);

    /**
     * -----------------------------------------
     * PRE-RISK ANALYSIS
     * -----------------------------------------
     */

    const riskScore =
      preRiskScore(text);

    /**
     * -----------------------------------------
     * AUDIT EVENT
     * -----------------------------------------
     */

    const auditEvent =
      createAuditEvent({
        filename,
        fileId,
        documentHash,
        contractType
      });

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,

      document_hash: documentHash,

      contract_type: contractType,

      pre_risk_score: riskScore,

      audit_event: auditEvent
    };

  } catch (error) {
    console.error(
      "Contract ingestion error:",
      error
    );

    return {
      success: false,
      error:
        error.message ||
        "Contract ingestion failed"
    };
  }
}

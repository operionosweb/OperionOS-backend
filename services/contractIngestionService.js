import crypto from "crypto";

/**
 * =========================================
 * EU CONTRACT INGESTION ENGINE
 * =========================================
 */

function generateHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * DOCUMENT TYPE DETECTION (FAST LAYER)
 * -----------------------------------------
 */

function detectDocumentType(text = "") {
  const t = text.toLowerCase();

  if (t.includes("aircraft lease")) return "Aircraft Lease Agreement";
  if (t.includes("service level")) return "Service Level Agreement";
  if (t.includes("maintenance")) return "Maintenance Agreement";
  if (t.includes("procurement")) return "Procurement Contract";
  if (t.includes("purchase order")) return "Purchase Order";

  return "General Contract";
}

/**
 * -----------------------------------------
 * LIGHTWEIGHT RISK SIGNALS (PRE-AI)
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
 * EU AUDIT EVENT CREATION
 * -----------------------------------------
 */

function createAuditEvent({
  filename,
  fileId,
  documentHash,
  type
}) {
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
    if (!text) {
      return {
        success: false,
        error: "No contract text provided"
      };
    }

    /**
     * -----------------------------------------
     * HASHING (DEDUPLICATION CORE)
     * -----------------------------------------
     */

    const documentHash = generateHash(text);

    /**
     * -----------------------------------------
     * DETECTION LAYERS
     * -----------------------------------------
     */

    const contractType = detectDocumentType(text);
    const riskScore = preRiskScore(text);

    /**
     * -----------------------------------------
     * AUDIT EVENT (EU COMPLIANCE LAYER)
     * -----------------------------------------
     */

    const auditEvent = createAuditEvent({
      filename,
      fileId,
      documentHash,
      type: contractType
    });

    /**
     * -----------------------------------------
     * FINAL INGESTION OUTPUT
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
    console.error("Ingestion error:", error);

    return {
      success: false,
      error: error.message || "Ingestion failed"
    };
  }
}

import crypto from "crypto";

/**
 * =========================================
 * OPERION CONTRACT INGESTION ENGINE
 * EU-FIRST ARCHITECTURE (GLOBAL READY)
 * =========================================
 */

/**
 * -----------------------------------------
 * HASHING (DEDUP + ID CORE)
 * -----------------------------------------
 */

function generateHash(text = "") {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * -----------------------------------------
 * DOCUMENT TYPE DETECTION (FAST CLASSIFIER)
 * -----------------------------------------
 */

function detectDocumentType(text = "") {
  const t = text.toLowerCase();

  const rules = [
    { match: "aircraft lease", type: "Aircraft Lease Agreement" },
    { match: "service level", type: "Service Level Agreement" },
    { match: "maintenance agreement", type: "Maintenance Agreement" },
    { match: "procurement", type: "Procurement Contract" },
    { match: "purchase order", type: "Purchase Order" },
    { match: "vendor agreement", type: "Vendor Agreement" }
  ];

  for (const rule of rules) {
    if (t.includes(rule.match)) return rule.type;
  }

  return "General Contract";
}

/**
 * -----------------------------------------
 * PRE-AI RISK SIGNAL ENGINE
 * -----------------------------------------
 * Lightweight heuristic scoring BEFORE LLM
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
    "force majeure",
    "governing law",
    "arbitration"
  ];

  for (const signal of signals) {
    if (t.includes(signal)) score += 6;
  }

  return Math.min(100, score);
}

/**
 * -----------------------------------------
 * EU AUDIT EVENT GENERATOR
 * -----------------------------------------
 * Designed for future:
 * - DB logging (Postgres / Supabase)
 * - SIEM export
 * - compliance traceability
 */

function createAuditEvent({
  filename,
  fileId,
  documentHash,
  type,
  riskScore
}) {
  return {
    event_type: "contract_ingested",
    timestamp: new Date().toISOString(),

    file: {
      name: filename,
      id: fileId
    },

    document: {
      hash: documentHash,
      type
    },

    risk: {
      pre_ai_score: riskScore
    },

    compliance: {
      region: "EU-first",
      gdpr_mode: "enabled",
      audit_level: "standard"
    }
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

    /**
     * -----------------------------------------
     * CORE PROCESSING
     * -----------------------------------------
     */

    const documentHash = generateHash(text);
    const contractType = detectDocumentType(text);
    const riskScore = preRiskScore(text);

    /**
     * -----------------------------------------
     * AUDIT LAYER
     * -----------------------------------------
     */

    const auditEvent = createAuditEvent({
      filename,
      fileId,
      documentHash,
      type: contractType,
      riskScore
    });

    /**
     * -----------------------------------------
     * FINAL RESPONSE STRUCTURE
     * -----------------------------------------
     */

    return {
      success: true,

      data: {
        document_hash: documentHash,
        contract_type: contractType,
        pre_risk_score: riskScore
      },

      audit: auditEvent,

      meta: {
        engine: "operion-ingestion-v1",
        mode: "eu-first-global-ready"
      }
    };

  } catch (error) {
    console.error("Ingestion error:", error);

    return {
      success: false,
      error: error.message || "Ingestion failed"
    };
  }
}

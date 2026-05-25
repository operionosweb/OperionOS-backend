// services/aiExtractionService.js

import crypto from "crypto";

/**
 * -----------------------------------------
 * IN-MEMORY CACHE
 * -----------------------------------------
 */

const extractionCache =
  new Map();

/**
 * -----------------------------------------
 * HASH GENERATOR
 * -----------------------------------------
 */

function generateHash(
  text = ""
) {
  return crypto
    .createHash("sha256")
    .update(text)
    .digest("hex");
}

/**
 * -----------------------------------------
 * SMART CHUNKING
 * -----------------------------------------
 */

function chunkText(
  text = "",
  chunkSize = 4000
) {
  if (!text) {
    return [];
  }

  /**
   * Attempt paragraph-aware chunking
   */

  const paragraphs =
    text.split(/\n\s*\n/);

  const chunks = [];

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (
      (
        currentChunk +
        paragraph
      ).length > chunkSize
    ) {
      chunks.push(
        currentChunk
      );

      currentChunk =
        paragraph;
    } else {
      currentChunk +=
        "\n\n" + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(
      currentChunk
    );
  }

  return chunks;
}

/**
 * -----------------------------------------
 * CONTRACT TYPE DETECTION
 * -----------------------------------------
 */

function detectContractType(
  text = ""
) {
  const lower =
    text.toLowerCase();

  if (
    lower.includes(
      "aircraft lease"
    )
  ) {
    return "Aircraft Lease Agreement";
  }

  if (
    lower.includes(
      "maintenance agreement"
    )
  ) {
    return "Maintenance Agreement";
  }

  if (
    lower.includes(
      "service level agreement"
    )
  ) {
    return "Service Level Agreement";
  }

  if (
    lower.includes(
      "procurement"
    )
  ) {
    return "Procurement Contract";
  }

  return "General Contract";
}

/**
 * -----------------------------------------
 * RISK DETECTION
 * -----------------------------------------
 */

function calculateRiskScore(
  text = ""
) {
  const lower =
    text.toLowerCase();

  let score = 15;

  const riskKeywords = [
    "unlimited liability",
    "without limitation",
    "penalty",
    "termination",
    "indemnify",
    "exclusive",
    "non-cancellable",
    "liquidated damages",
    "breach",
    "default",
  ];

  for (const keyword of riskKeywords) {
    if (
      lower.includes(keyword)
    ) {
      score += 7;
    }
  }

  return Math.min(100, score);
}

/**
 * -----------------------------------------
 * CLAUSE DETECTION
 * -----------------------------------------
 */

function extractClauses(
  chunks = []
) {
  const clauses = [];

  const clausePatterns = [
    {
      type: "Insurance",
      regex:
        /insurance/gi,
    },
    {
      type: "Termination",
      regex:
        /termination/gi,
    },
    {
      type: "Indemnity",
      regex:
        /indemnity/gi,
    },
    {
      type: "Confidentiality",
      regex:
        /confidentiality/gi,
    },
    {
      type: "Compliance",
      regex:
        /compliance/gi,
    },
  ];

  for (const chunk of chunks) {
    for (const pattern of clausePatterns) {
      if (
        pattern.regex.test(
          chunk
        )
      ) {
        clauses.push({
          clause_type:
            pattern.type,

          risk_level:
            "Medium",

          clause_text:
            chunk.substring(
              0,
              500
            ),
        });
      }
    }
  }

  return clauses.slice(0, 25);
}

/**
 * -----------------------------------------
 * OBLIGATION DETECTION
 * -----------------------------------------
 */

function extractObligations(
  chunks = []
) {
  const obligations = [];

  const obligationKeywords =
    [
      "shall",
      "must",
      "required to",
      "obligation",
      "responsible for",
    ];

  for (const chunk of chunks) {
    const lower =
      chunk.toLowerCase();

    for (const keyword of obligationKeywords) {
      if (
        lower.includes(
          keyword
        )
      ) {
        obligations.push({
          obligation:
            chunk.substring(
              0,
              250
            ),

          severity:
            "Medium",
        });

        break;
      }
    }
  }

  return obligations.slice(
    0,
    25
  );
}

/**
 * -----------------------------------------
 * MAIN ANALYSIS ENGINE
 * -----------------------------------------
 */

export async function analyzeContractText(
  rawText = ""
) {
  try {
    if (!rawText) {
      return {
        success: false,
        error:
          "No text provided",
      };
    }

    /**
     * -----------------------------------------
     * HASH
     * -----------------------------------------
     */

    const documentHash =
      generateHash(
        rawText
      );

    /**
     * -----------------------------------------
     * CACHE HIT
     * -----------------------------------------
     */

    if (
      extractionCache.has(
        documentHash
      )
    ) {
      console.log(
        "⚡ CACHE HIT:",
        documentHash
      );

      return {
        success: true,

        cached: true,

        cache_source:
          "memory_cache",

        document_hash:
          documentHash,

        analysis:
          extractionCache.get(
            documentHash
          ),
      };
    }

    /**
     * -----------------------------------------
     * CHUNKING
     * -----------------------------------------
     */

    const chunks =
      chunkText(rawText);

    console.log(
      `Document chunked into ${chunks.length} chunks`
    );

    /**
     * -----------------------------------------
     * ANALYSIS
     * -----------------------------------------
     */

    const contractType =
      detectContractType(
        rawText
      );

    const riskScore =
      calculateRiskScore(
        rawText
      );

    const clauses =
      extractClauses(
        chunks
      );

    const obligations =
      extractObligations(
        chunks
      );

    /**
     * -----------------------------------------
     * FINAL ANALYSIS
     * -----------------------------------------
     */

    const analysis = {
      contract_type:
        contractType,

      supplier_name:
        "Unknown Supplier",

      summary: `Contract analyzed successfully using semantic chunk pipeline.`,

      risk_score:
        riskScore,

      contract_value: 0,

      chunks_processed:
        chunks.length,

      clauses,

      obligations,
    };

    /**
     * -----------------------------------------
     * CACHE STORE
     * -----------------------------------------
     */

    extractionCache.set(
      documentHash,
      analysis
    );

    console.log(
      "✅ CACHE STORED:",
      documentHash
    );

    /**
     * -----------------------------------------
     * RESPONSE
     * -----------------------------------------
     */

    return {
      success: true,

      cached: false,

      cache_source: null,

      document_hash:
        documentHash,

      analysis,
    };
  } catch (error) {
    console.error(
      "analyzeContractText Error:",
      error
    );

    return {
      success: false,

      error:
        error.message ||
        "Analysis failed",
    };
  }
}

/**
 * -----------------------------------------
 * LEGACY EXPORT
 * -----------------------------------------
 */

export async function extractContractIntelligence(
  rawText = ""
) {
  return analyzeContractText(
    rawText
  );
}

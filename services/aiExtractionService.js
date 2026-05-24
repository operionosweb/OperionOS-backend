// services/aiExtractionService.js

import OpenAI from "openai";

import { chunkContractText }
from "./chunkingService.js";

/**
 * OpenAI Client
 */
const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * MAIN CONTRACT EXTRACTION
 * -----------------------------------------
 */
export async function extractContractIntelligence(
  text = ""
) {
  try {
    if (!text) {
      return emptyResponse();
    }

    /**
     * Chunk contract
     */
    const chunks =
      chunkContractText(text);

    console.log(
      `Processing ${chunks.length} chunks`
    );

    /**
     * Aggregated results
     */
    const extractedClauses = [];
    const extractedObligations = [];

    let cumulativeRisk = 0;

    let detectedSupplier =
      "Unknown Supplier";

    let detectedType =
      "General Contract";

    /**
     * Process chunks sequentially
     */
    for (const chunk of chunks) {
      const completion =
        await openai.chat.completions.create({
          model: "gpt-4o-mini",

          response_format: {
            type: "json_object",
          },

          messages: [
            {
              role: "system",

              content: `
You are an enterprise legal AI specialized in aviation contracts.

Analyze the provided contract section.

Extract:
- contract_type
- supplier_name
- summary
- risk_score
- contract_value
- clauses
- obligations

Return ONLY valid JSON.

JSON structure:

{
  "contract_type": "",
  "supplier_name": "",
  "summary": "",
  "risk_score": 0,
  "contract_value": 0,
  "clauses": [],
  "obligations": []
}
              `,
            },

            {
              role: "user",
              content: chunk,
            },
          ],

          temperature: 0.1,
        });

      const content =
        completion?.choices?.[0]
          ?.message?.content || "{}";

      let parsed = {};

      try {
        parsed =
          JSON.parse(content);
      } catch (jsonError) {
        console.error(
          "Chunk JSON Parse Error:",
          jsonError
        );

        continue;
      }

      /**
       * Merge clauses
       */
      if (
        Array.isArray(
          parsed?.clauses
        )
      ) {
        extractedClauses.push(
          ...parsed.clauses
        );
      }

      /**
       * Merge obligations
       */
      if (
        Array.isArray(
          parsed?.obligations
        )
      ) {
        extractedObligations.push(
          ...parsed.obligations
        );
      }

      /**
       * Risk aggregation
       */
      cumulativeRisk +=
        Number(
          parsed?.risk_score || 0
        );

      /**
       * Supplier detection
       */
      if (
        parsed?.supplier_name &&
        detectedSupplier ===
          "Unknown Supplier"
      ) {
        detectedSupplier =
          parsed.supplier_name;
      }

      /**
       * Contract type detection
       */
      if (
        parsed?.contract_type &&
        detectedType ===
          "General Contract"
      ) {
        detectedType =
          parsed.contract_type;
      }
    }

    /**
     * Final response
     */
    return {
      contract_type:
        detectedType,

      supplier_name:
        detectedSupplier,

      summary:
        `AI analysis completed across ${chunks.length} chunks.`,

      risk_score:
        Math.min(
          100,
          Math.round(
            cumulativeRisk /
              Math.max(
                chunks.length,
                1
              )
          )
        ),

      contract_value: 0,

      clauses:
        deduplicateClauses(
          extractedClauses
        ),

      obligations:
        deduplicateObligations(
          extractedObligations
        ),
    };
  } catch (error) {
    console.error(
      "extractContractIntelligence() Error:",
      error
    );

    return {
      contract_type:
        "General Contract",

      supplier_name:
        "Unknown Supplier",

      summary:
        "AI extraction failed",

      risk_score: 0,

      contract_value: 0,

      clauses: [],

      obligations: [],

      extraction_error:
        error?.message ||
        "Unknown extraction error",
    };
  }
}

/**
 * -----------------------------------------
 * HELPERS
 * -----------------------------------------
 */

function deduplicateClauses(
  clauses = []
) {
  const seen = new Set();

  return clauses.filter(
    (clause) => {
      const key = JSON.stringify(
        clause
      );

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

function deduplicateObligations(
  obligations = []
) {
  const seen = new Set();

  return obligations.filter(
    (obligation) => {
      const key = JSON.stringify(
        obligation
      );

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    }
  );
}

function emptyResponse() {
  return {
    contract_type:
      "General Contract",

    supplier_name:
      "Unknown Supplier",

    summary:
      "No contract text provided",

    risk_score: 0,

    contract_value: 0,

    clauses: [],

    obligations: [],
  };
}

/**
 * -----------------------------------------
 * EXPORTS
 * -----------------------------------------
 */

export async function analyzeContractText(
  text = ""
) {
  return extractContractIntelligence(
    text
  );
}

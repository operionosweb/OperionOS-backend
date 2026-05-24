// services/aiExtractionService.js

import OpenAI from "openai";

/**
 * -----------------------------------------
 * OPENAI CLIENT
 * -----------------------------------------
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * -----------------------------------------
 * MAIN AI EXTRACTION
 * -----------------------------------------
 */

export async function extractContractIntelligence(
  contractText = ""
) {
  try {
    if (!contractText) {
      throw new Error(
        "Contract text is required"
      );
    }

    /**
     * Limit text size
     */
    const truncatedText =
      contractText.substring(
        0,
        15000
      );

    /**
     * -----------------------------------------
     * OPENAI PROMPT
     * -----------------------------------------
     */

    const prompt = `
You are OPERION OS AI Legal Intelligence Engine.

Analyze this contract and return STRICT JSON only.

Return this structure:

{
  "contract_type": "",
  "supplier_name": "",
  "summary": "",
  "risk_score": 0,
  "contract_value": 0,
  "start_date": "",
  "expiry_date": "",
  "clauses": [
    {
      "clause_title": "",
      "clause_type": "",
      "risk_level": "",
      "summary": "",
      "clause_text": ""
    }
  ],
  "obligations": [
    {
      "title": "",
      "description": "",
      "severity": "",
      "deadline": "",
      "status": "Pending"
    }
  ]
}

Contract:

${truncatedText}
`;

    /**
     * -----------------------------------------
     * OPENAI CALL
     * -----------------------------------------
     */

    const response =
      await openai.chat.completions.create({
        model: "gpt-4.1-mini",

        messages: [
          {
            role: "system",
            content:
              "You are an enterprise legal AI system.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        temperature: 0.2,

        response_format: {
          type: "json_object",
        },
      });

    /**
     * -----------------------------------------
     * PARSE RESPONSE
     * -----------------------------------------
     */

    const content =
      response.choices?.[0]?.message
        ?.content || "{}";

    const parsed =
      JSON.parse(content);

    /**
     * -----------------------------------------
     * NORMALIZE OUTPUT
     * -----------------------------------------
     */

    return {
      contract_type:
        parsed.contract_type ||
        "General Contract",

      supplier_name:
        parsed.supplier_name ||
        "Unknown Supplier",

      summary:
        parsed.summary || "",

      risk_score:
        Number(
          parsed.risk_score || 0
        ),

      contract_value:
        Number(
          parsed.contract_value ||
            0
        ),

      start_date:
        parsed.start_date || null,

      expiry_date:
        parsed.expiry_date || null,

      clauses: Array.isArray(
        parsed.clauses
      )
        ? parsed.clauses
        : [],

      obligations: Array.isArray(
        parsed.obligations
      )
        ? parsed.obligations
        : [],
    };
  } catch (error) {
    console.error(
      "AI Extraction Error:",
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
        error.message,
    };
  }
}

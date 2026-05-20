// services/contractAnalysisService.js

const pdfService = require("./pdfService");
const clauseExtractionService = require("./clauseExtractionService");
const obligationExtractor = require("./obligationExtractor");

/**
 * Main contract analysis pipeline
 * 1. Extract text from PDF
 * 2. Extract clauses
 * 3. Extract obligations from clauses
 * 4. Return structured contract intelligence output
 */
async function analyzeContract(fileBuffer, fileName = "unknown.pdf") {
  try {
    // STEP 1: Extract raw text from PDF
    const extractedText = await pdfService.extractText(fileBuffer);

    if (!extractedText) {
      throw new Error("PDF text extraction failed");
    }

    // STEP 2: Extract clauses
    const clauses = await clauseExtractionService.extractClauses(extractedText);

    if (!clauses || !Array.isArray(clauses)) {
      throw new Error("Clause extraction failed or returned invalid format");
    }

    // STEP 3: Extract obligations from clauses
    const obligations = await obligationExtractor.extractObligations(clauses);

    // STEP 4: Build final structured response
    return {
      success: true,
      contractName: fileName,
      clausesDetected: clauses.length,
      obligationsDetected: obligations ? obligations.length : 0,
      extractedTextLength: extractedText.length,
      clauses,
      obligations
    };

  } catch (error) {
    console.error("Contract analysis failed:", error);

    return {
      success: false,
      error: error.message || "Unknown error during contract analysis",
      contractName: fileName,
      clausesDetected: 0,
      obligationsDetected: 0,
      extractedTextLength: 0,
      clauses: [],
      obligations: []
    };
  }
}

module.exports = {
  analyzeContract
};

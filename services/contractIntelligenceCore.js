// services/contractIntelligenceCore.js

const contractPipeline = require("../contractPipeline");
const contractRiskScoringEngine = require("../contractRiskScoringEngine");
const clauseReasoningEngine = require("../clauseReasoningEngine");
const contractCopilotEngine = require("../contractCopilotEngine");
const contractVersionEngine = require("../contractVersionEngine");
const contractDashboardEngine = require("../contractDashboardEngine");
const decisionOS = require("../decisionOS");

/**
 * Contract Intelligence Core
 * -----------------------------------------
 * This is the single orchestration layer for ALL contract intelligence operations.
 * It ensures every uploaded contract flows through a unified intelligence pipeline.
 */

class ContractIntelligenceCore {
  
  /**
   * MAIN ENTRY POINT
   * Called whenever a contract is uploaded or updated.
   */
  static async processContract({
    contractId,
    fileText,
    metadata = {},
    source = "upload"
  }) {
    try {
      
      // STEP 1: Normalize + preprocess contract
      const normalizedContract = await contractPipeline.normalize({
        contractId,
        fileText,
        metadata
      });

      // STEP 2: Clause extraction
      const clauses = await clauseReasoningEngine.extractClauses({
        contractText: normalizedContract.text
      });

      // STEP 3: Risk scoring
      const riskScore = await contractRiskScoringEngine.scoreContract({
        contractText: normalizedContract.text,
        clauses
      });

      // STEP 4: Contract Copilot summary + intelligence
      const copilotInsight = await contractCopilotEngine.analyze({
        contractText: normalizedContract.text,
        clauses,
        metadata
      });

      // STEP 5: Version tracking
      const versionData = await contractVersionEngine.process({
        contractId,
        fileText: normalizedContract.text
      });

      // STEP 6: Decision OS integration
      const decisionOutput = await decisionOS.evaluate({
        contractId,
        clauses,
        riskScore,
        metadata
      });

      // STEP 7: Build unified intelligence object
      const intelligence = {
        contractId,
        source,

        summary: copilotInsight.summary,
        keyInsights: copilotInsight.insights,

        clauses,
        riskScore,

        decisionRecommendations: decisionOutput.recommendations,

        version: versionData.version,
        timestamp: new Date().toISOString()
      };

      // STEP 8: Send to dashboard engine (non-blocking)
      try {
        await contractDashboardEngine.update(intelligence);
      } catch (err) {
        console.warn("Dashboard update failed:", err.message);
      }

      return intelligence;

    } catch (error) {
      console.error("ContractIntelligenceCore error:", error);
      throw new Error("Failed to process contract intelligence");
    }
  }

  /**
   * QUICK ANALYSIS (for chat / copilot queries)
   */
  static async quickAnalyze({ contractText }) {
    const clauses = await clauseReasoningEngine.extractClauses({
      contractText
    });

    const riskScore = await contractRiskScoringEngine.scoreContract({
      contractText,
      clauses
    });

    return {
      clauses,
      riskScore
    };
  }

  /**
   * RISK ONLY MODE (for dashboards)
   */
  static async riskOnly({ contractText }) {
    return await contractRiskScoringEngine.scoreContract({
      contractText
    });
  }

  /**
   * CLAUSE ONLY MODE (for UI inspection)
   */
  static async clausesOnly({ contractText }) {
    return await clauseReasoningEngine.extractClauses({
      contractText
    });
  }
}

module.exports = ContractIntelligenceCore;

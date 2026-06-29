import { diffClauses, calculateRiskDelta } from "../contractPipeline.js";

/**
 * =====================================================
 * OPERION CONTRACT INTELLIGENCE CORE
 * =====================================================
 *
 * Single orchestration layer for:
 *
 * - Contract ingestion
 * - Clause extraction
 * - Obligation extraction
 * - Deadline extraction
 * - Risk assessment
 * - Recommendation generation
 *
 * Aviation-first architecture.
 *
 * This layer becomes the foundation for:
 *
 * 1. Contract Intelligence
 * 2. Aviation Intelligence
 * 3. Predictive Risk Engine
 * 4. Scenario Simulation
 *
 * =====================================================
 */

export class ContractIntelligenceCore {
  /**
   * ---------------------------------------------
   * Normalize Contract Text
   * ---------------------------------------------
   */
  static normalizeText(text = "") {
    return text
      .replace(/\r/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  /**
   * ---------------------------------------------
   * Clause Extraction
   * ---------------------------------------------
   *
   * Placeholder implementation.
   *
   * Later:
   * - OpenAI
   * - Claude
   * - Gemini
   * - Local LLM
   */
  static async extractClauses(contractText) {
    const clauses = [];

    const lower = contractText.toLowerCase();

    if (lower.includes("termination")) {
      clauses.push({
        type: "Termination",
        risk: "Medium",
        summary: "Termination clause detected"
      });
    }

    if (lower.includes("force majeure")) {
      clauses.push({
        type: "Force Majeure",
        risk: "Medium",
        summary: "Force majeure clause detected"
      });
    }

    if (lower.includes("liability")) {
      clauses.push({
        type: "Liability",
        risk: "High",
        summary: "Liability clause detected"
      });
    }

    return clauses;
  }

  /**
   * ---------------------------------------------
   * Obligation Extraction
   * ---------------------------------------------
   */
  static async extractObligations(contractText) {
    const obligations = [];

    const lines = contractText.split("\n");

    for (const line of lines) {
      const lower = line.toLowerCase();

      if (
        lower.includes("shall") ||
        lower.includes("must") ||
        lower.includes("required")
      ) {
        obligations.push({
          obligation: line.trim()
        });
      }
    }

    return obligations;
  }

  /**
   * ---------------------------------------------
   * Deadline Extraction
   * ---------------------------------------------
   */
  static async extractDeadlines(contractText) {
    const deadlines = [];

    const regex =
      /\b\d+\s+(days|months|years|hours|weeks)\b/gi;

    const matches = contractText.match(regex);

    if (matches) {
      matches.forEach(item => {
        deadlines.push({
          deadline: item
        });
      });
    }

    return deadlines;
  }

  /**
   * ---------------------------------------------
   * Risk Assessment
   * ---------------------------------------------
   */
  static async calculateRiskScore(clauses) {
    let score = 0;

    clauses.forEach(clause => {
      if (clause.risk === "High") score += 30;
      if (clause.risk === "Medium") score += 15;
      if (clause.risk === "Low") score += 5;
    });

    return Math.min(score, 100);
  }

  /**
   * ---------------------------------------------
   * Recommendations
   * ---------------------------------------------
   */
  static async generateRecommendations({
    clauses,
    riskScore
  }) {
    const recommendations = [];

    if (riskScore > 70) {
      recommendations.push(
        "Immediate legal review recommended."
      );
    }

    clauses.forEach(clause => {
      if (clause.type === "Liability") {
        recommendations.push(
          "Review liability cap and indemnity exposure."
        );
      }

      if (clause.type === "Termination") {
        recommendations.push(
          "Verify termination notice periods."
        );
      }
    });

    return recommendations;
  }

  /**
   * ---------------------------------------------
   * Main Intelligence Pipeline
   * ---------------------------------------------
   */
  static async processContract({
    contractText,
    previousClauses = [],
    previousRiskScore = 0
  }) {
    const normalizedText =
      this.normalizeText(contractText);

    const clauses =
      await this.extractClauses(normalizedText);

    const obligations =
      await this.extractObligations(normalizedText);

    const deadlines =
      await this.extractDeadlines(normalizedText);

    const riskScore =
      await this.calculateRiskScore(clauses);

    const recommendations =
      await this.generateRecommendations({
        clauses,
        riskScore
      });

    const clauseChanges = diffClauses(
      previousClauses,
      clauses
    );

    const riskDelta =
      calculateRiskDelta(
        previousRiskScore,
        riskScore
      );

    return {
      summary: {
        clauseCount: clauses.length,
        obligationCount: obligations.length,
        deadlineCount: deadlines.length,
        riskScore
      },

      clauses,
      obligations,
      deadlines,

      recommendations,

      clauseChanges,
      riskDelta,

      generatedAt: new Date().toISOString()
    };
  }
}

export default ContractIntelligenceCore;

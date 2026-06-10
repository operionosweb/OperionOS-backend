const contractRiskScoringEngine = require("../contractRiskScoringEngine");
const clauseReasoningEngine = require("../clauseReasoningEngine");
const clauseComparisonEngine = require("../clauseComparisonEngine");
const contractNegotiationSimulator = require("../contractNegotiationSimulator");
const decisionOS = require("../decisionOS");
const contractCopilotEngine = require("../contractCopilotEngine");

class OperionOrchestrator {
  async analyzeContract(input) {

    // 1. UNDERSTANDING LAYER
    const clauses = await clauseReasoningEngine.extractClauses(input);
    const structured = await clauseComparisonEngine.analyze(clauses);

    // 2. RISK LAYER
    const risk = await contractRiskScoringEngine.score(structured);

    // FIX: unified risk aggregation
    const totalRisk = risk.clauses.reduce((sum, c) => {
      return sum + (c.score * (c.weight || 1));
    }, 0);

    const normalizedRisk = Math.min(100, totalRisk);

    // 3. SIMULATION LAYER
    const simulation = await contractNegotiationSimulator.run({
      clauses: structured,
      risk: normalizedRisk
    });

    const decision = await decisionOS.evaluate({
      risk: normalizedRisk,
      simulation
    });

    // 4. FINAL COPILOT OUTPUT
    const final = await contractCopilotEngine.generate({
      clauses: structured,
      risk: normalizedRisk,
      simulation,
      decision
    });

    return {
      risk_score: normalizedRisk,
      decision,
      clauses: structured,
      simulation,
      copilot: final
    };
  }
}

module.exports = new OperionOrchestrator();

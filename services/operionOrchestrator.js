import contractRiskScoringEngine from "../contractRiskScoringEngine.js";
import clauseReasoningEngine from "../clauseReasoningEngine.js";
import clauseComparisonEngine from "../clauseComparisonEngine.js";
import contractNegotiationSimulator from "../contractNegotiationSimulator.js";
import decisionOS from "../decisionOS.js";
import contractCopilotEngine from "../contractCopilotEngine.js";

class OperionOrchestrator {
  async analyzeContract(input) {
    const { contract_text, context } = input;

    try {
      // =========================
      // 1. UNDERSTANDING LAYER
      // =========================
      const clauses = await clauseReasoningEngine.extractClauses(contract_text);

      const structured = await clauseComparisonEngine.analyze(clauses);

      // =========================
      // 2. RISK LAYER
      // =========================
      const risk = await contractRiskScoringEngine.score(structured);

      // FIX: safe aggregation (prevents "risk = 0" bug)
      const totalRisk = (risk?.clauses || []).reduce((sum, c) => {
        const score = c.score || 0;
        const weight = c.weight || 1;
        return sum + score * weight;
      }, 0);

      const normalizedRisk = Math.min(100, Math.round(totalRisk));

      // =========================
      // 3. SIMULATION LAYER
      // =========================
      const simulation = await contractNegotiationSimulator.run({
        clauses: structured,
        risk: normalizedRisk,
        context,
      });

      // =========================
      // 4. DECISION ENGINE
      // =========================
      const decision = await decisionOS.evaluate({
        risk: normalizedRisk,
        simulation,
      });

      // =========================
      // 5. COPILOT (FINAL OUTPUT)
      // =========================
      const copilot = await contractCopilotEngine.generate({
        clauses: structured,
        risk: normalizedRisk,
        simulation,
        decision,
        context,
      });

      // =========================
      // FINAL RESPONSE
      // =========================
      return {
        risk_score: normalizedRisk,
        decision,
        clauses: structured,
        simulation,
        copilot,
        metadata: {
          request_id: context?.request_id,
          org_id: context?.org_id,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      console.error("❌ Operion Orchestrator Error:", err);
      throw err;
    }
  }
}

export default new OperionOrchestrator();

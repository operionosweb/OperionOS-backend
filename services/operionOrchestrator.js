import clauseReasoningEngine from "../clauseReasoningEngine.js";
import contractCopilotEngine from "../contractCopilotEngine.js";

class OperionOrchestrator {
  async analyzeContract(input) {
    const { contract_text, context } = input;

    try {
      // =========================
      // 1. CLAUSE EXTRACTION ONLY
      // =========================
      const clauses =
        await clauseReasoningEngine.extractClauses(contract_text);

      // =========================
      // 2. SINGLE AI DECISION ENGINE
      // =========================
      const copilotResult =
        await contractCopilotEngine.generateContractCopilot({
          contract: { clauses },
          company_context: context,
        });

      // =========================
      // 3. STANDARDIZED OUTPUT WRAPPER
      // =========================
      return {
        success: true,

        risk_score: copilotResult?.risk_level || "MEDIUM",

        decision_chain: copilotResult?.decision_chain || [],

        executive_summary:
          copilotResult?.executive_summary || "",

        top_risks:
          copilotResult?.top_operational_risks || [],

        metadata: {
          request_id: context?.request_id,
          org_id: context?.org_id,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      console.error("❌ Operion Orchestrator Error:", err);

      return {
        success: false,
        error: "Contract analysis failed",
        decision_chain: [],
        executive_summary: "",
        top_risks: [],
      };
    }
  }
}

export default new OperionOrchestrator();

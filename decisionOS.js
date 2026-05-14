import axios from "axios";

/* ===============================
   HELPER: SAFE PARSE
=============================== */

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ===============================
   HYBRID AI LAYER (MISTRAL → OPENAI)
=============================== */

async function callLLM(prompt) {
  try {
    // ===========================
    // MISTRAL (PRIMARY - EUROPEAN)
    // ===========================
    if (process.env.MISTRAL_API_KEY) {
      const res = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      return res.data?.choices?.[0]?.message?.content;
    }

    // ===========================
    // OPENAI FALLBACK
    // ===========================
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.data?.choices?.[0]?.message?.content;

  } catch (err) {
    console.error("Decision OS LLM error:", err.message);
    throw new Error("Decision OS AI failed");
  }
}

/* ===============================
   DECISION OS ENGINE
=============================== */

export async function generateDecisionOS({
  contract,
  stressTest,
  transition,
  fleetRisk,
  maintenance
}) {

  const prompt = `
You are Operion Decision OS.

You are NOT a model.
You are a senior aviation CFO + fleet strategist + lessor risk director.

Your job:
Turn ALL system outputs into ONE unified decision layer.

You will receive multiple intelligence layers:

1. CONTRACT DATA
${contract?.summary || ""}

2. FINANCIAL STRESS TEST
${JSON.stringify(stressTest || {}).slice(0, 20000)}

3. AIRCRAFT TRANSITION ANALYSIS
${JSON.stringify(transition || {}).slice(0, 20000)}

4. FLEET RISK (if available)
${JSON.stringify(fleetRisk || {}).slice(0, 20000)}

5. MAINTENANCE POSITIONING
${JSON.stringify(maintenance || {}).slice(0, 20000)}

---

TASK:

Create a unified decision output for an airline CFO / lessor / asset manager.

Return ONLY valid JSON:

{
  "decision_summary": {
    "overall_health_score": 0,
    "recommended_action": "HOLD | MONITOR | RESTRUCTURE | SELL | REPOSITION | DEFER_RETURN",
    "urgency_level": "LOW | MEDIUM | HIGH | CRITICAL"
  },

  "aircraft_level_decision": {
    "keep_or_exit": "KEEP | EXIT | REVIEW",
    "optimal_strategy": "",
    "risk_alignment": "LOW | MEDIUM | HIGH"
  },

  "financial_view": {
    "stress_status": "STABLE | UNDER_PRESSURE | DISTRESSED",
    "cash_flow_outlook": "POSITIVE | NEUTRAL | NEGATIVE",
    "default_risk": "LOW | MEDIUM | HIGH | EXTREME"
  },

  "operational_view": {
    "transition_readiness": "READY | DELAYED | HIGH_RISK",
    "maintenance_pressure": "LOW | MEDIUM | HIGH",
    "fleet_efficiency_impact": ""
  },

  "key_risk_drivers": [
    ""
  ],

  "recommended_actions": [
    ""
  ],

  "what_would_i_do_as_cfo": ""
}

Rules:
- Be extremely decisive
- No hedging
- Think like aviation CFO under pressure
- Think like asset manager protecting capital
- No markdown
- Return JSON only
`;

  const raw = await callLLM(prompt);
  const parsed = safeParse(raw);

  if (!parsed) {
    return {
      decision_summary: {
        overall_health_score: 50,
        recommended_action: "MONITOR",
        urgency_level: "MEDIUM"
      },
      aircraft_level_decision: {
        keep_or_exit: "REVIEW",
        optimal_strategy: "Fallback decision model",
        risk_alignment: "MEDIUM"
      },
      financial_view: {
        stress_status: "UNDER_PRESSURE",
        cash_flow_outlook: "NEUTRAL",
        default_risk: "MEDIUM"
      },
      operational_view: {
        transition_readiness: "DELAYED",
        maintenance_pressure: "MEDIUM",
        fleet_efficiency_impact: "Fallback"
      },
      key_risk_drivers: [],
      recommended_actions: [],
      what_would_i_do_as_cfo: "Fallback decision output"
    };
  }

  return parsed;
}

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// SUPABASE
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// AGENTS
// =======================
const AGENTS = [
  {
    agent_id: "aviation_basic",
    domain: "aviation",
    weight: 1,
    run: (env, weight) => ({
      decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
      confidence: 0.6 * weight
    })
  },
  {
    agent_id: "aviation_routing",
    domain: "aviation",
    weight: 1,
    run: (env, weight) => ({
      decision:
        env.congestionRisk === "HIGH"
          ? "DELAY"
          : "PROCEED",
      confidence: 0.9 * weight
    })
  }
];

// =======================
// ENV
// =======================
function buildEnv(weather, traffic) {
  const wind = weather?.windspeed || 10;

  return {
    weatherRisk:
      wind > 45 ? "EXTREME" :
      wind > 30 ? "HIGH" :
      wind > 20 ? "MODERATE" :
      "LOW",

    congestionRisk:
      traffic > 8500 ? "HIGH" :
      traffic > 6500 ? "MEDIUM" :
      "LOW",

    wind,
    traffic
  };
}

// =======================
// EXECUTION
// =======================
function executeAgents(env) {
  return AGENTS.map(agent => {
    const result = agent.run(env, agent.weight);

    return {
      agent_id: agent.agent_id,
      decision: result.decision,
      confidence: result.confidence
    };
  });
}

// =======================
// META ANALYSIS
// =======================
function analyzeSystem(outputs) {
  const scores = {};
  let total = 0;

  for (const o of outputs) {
    scores[o.decision] = (scores[o.decision] || 0) + o.confidence;
    total += o.confidence;
  }

  const dominant = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  const entropy = Object.keys(scores).length / 4;

  return {
    dominant,
    instability: entropy,
    systemHealth: 1 - entropy
  };
}

// =======================
// META DECISION ENGINE (NEW)
// =======================
async function metaAdjustments(tenantId, analysis) {
  const adjustments = [];

  // If system unstable → increase diversity pressure
  if (analysis.instability > 0.6) {
    adjustments.push({
      tenant_id: tenantId,
      adjustment_type: "increase_diversity",
      target: "system",
      value: 0.2,
      reason: "High instability detected"
    });

    // weaken overly dominant agent behavior
    adjustments.push({
      tenant_id: tenantId,
      adjustment_type: "reduce_confidence_bias",
      target: "agents",
      value: -0.1,
      reason: "Prevent convergence collapse"
    });
  }

  // If stable → reinforce current strategy
  if (analysis.systemHealth > 0.7) {
    adjustments.push({
      tenant_id: tenantId,
      adjustment_type: "reinforce_current_policy",
      target: "system",
      value: 0.1,
      reason: "Stable system behavior"
    });
  }

  if (adjustments.length > 0) {
    await supabase.from("meta_adjustments").insert(adjustments);
  }

  return adjustments;
}

// =======================
// EXTERNAL DATA
// =======================
async function getWeather() {
  const res = await axios.get(
    "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
  );
  return res.data.current_weather;
}

async function getTraffic() {
  return 6000 + Math.random() * 4000;
}

// =======================
// MAIN ENDPOINT
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const outputs = executeAgents(env);

    const analysis = analyzeSystem(outputs);

    const adjustments = await metaAdjustments(tenantId, analysis);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision: analysis.dominant
    });

    res.json({
      tenantId,
      env,
      outputs,
      meta: analysis,
      adjustments
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🧠 Operion Recursive Meta-Agent Running");
});

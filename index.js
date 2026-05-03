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
const AGENTS = {
  aviation_basic: {
    domain: "aviation",
    run: (env, weight = 1) => ({
      decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
      confidence: 0.7 * weight
    })
  },

  aviation_routing: {
    domain: "aviation",
    run: (env, weight = 1) => ({
      decision:
        env.weatherRisk === "HIGH" ? "REROUTE" :
        env.congestionRisk === "HIGH" ? "DELAY" :
        "PROCEED",
      confidence: 0.9 * weight
    })
  }
};

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
// GET AGENT RELIABILITY
// =======================
async function getReliabilityMap(tenantId) {
  const { data } = await supabase
    .from("agent_reliability")
    .select("*")
    .eq("tenant_id", tenantId);

  const map = {};

  if (data) {
    for (const row of data) {
      map[row.agent_id] = row.reliability || 1;
    }
  }

  return map;
}

// =======================
// EXECUTE AGENTS (WEIGHTED)
// =======================
function executeAgents(agents, env, reliabilityMap) {
  return agents.map((agent, i) => {
    const weight = reliabilityMap[agent.domain] || 1;

    const result = agent.run(env, weight);

    return {
      agent_id: agent.domain,
      decision: result.decision,
      confidence: result.confidence
    };
  });
}

// =======================
// AGGREGATION (WEIGHTED VOTING)
// =======================
function aggregate(outputs) {
  const scores = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const o of outputs) {
    scores[o.decision] += o.confidence;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// SCORING
// =======================
function calculateScore(agentDecision, finalDecision, confidence) {
  const success = agentDecision === finalDecision;
  return {
    success,
    score: success ? confidence : 0
  };
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
// MAIN EXECUTION
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const reliabilityMap = await getReliabilityMap(tenantId);

    const agents = Object.values(AGENTS);

    const outputs = executeAgents(agents, env, reliabilityMap);

    const decision = aggregate(outputs);

    // =======================
    // STORE RUN
    // =======================
    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision
    });

    // =======================
    // UPDATE LEARNING SYSTEM
    // =======================
    for (const o of outputs) {
      const result = calculateScore(
        o.decision,
        decision,
        o.confidence
      );

      // store score
      await supabase.from("agent_scores").insert({
        tenant_id: tenantId,
        agent_id: o.agent_id,
        success: result.success,
        score: result.score,
        context: env
      });

      // update reliability
      const { data } = await supabase
        .from("agent_reliability")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("agent_id", o.agent_id)
        .single();

      if (data) {
        const newTotalRuns = (data.total_runs || 0) + 1;
        const newTotalScore = (data.total_score || 0) + result.score;
        const newReliability = newTotalScore / newTotalRuns;

        await supabase
          .from("agent_reliability")
          .update({
            total_runs: newTotalRuns,
            total_score: newTotalScore,
            reliability: newReliability,
            updated_at: new Date()
          })
          .eq("id", data.id);
      } else {
        await supabase.from("agent_reliability").insert({
          tenant_id: tenantId,
          agent_id: o.agent_id,
          total_runs: 1,
          total_score: result.score,
          reliability: result.score
        });
      }
    }

    res.json({
      tenantId,
      env,
      outputs,
      decision
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Operion OS - Adaptive Intelligence Engine Running");
});

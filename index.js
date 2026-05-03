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
// AGENTS (v1 SYSTEM)
// =======================
const AGENTS = {
  aviation_basic: {
    domain: "aviation",
    run: (env) => ({
      decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
      confidence: 0.7
    })
  },

  aviation_routing: {
    domain: "aviation",
    run: (env) => ({
      decision:
        env.weatherRisk === "HIGH" ? "REROUTE" :
        env.congestionRisk === "HIGH" ? "DELAY" :
        "PROCEED",
      confidence: 0.9
    })
  }
};

// =======================
// ENV BUILDER
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
// LOAD AGENTS FOR TENANT
// =======================
async function getTenantAgents() {
  return Object.values(AGENTS);
}

// =======================
// EXECUTE AGENTS
// =======================
function executeAgents(agents, env) {
  return agents.map((agent) => {
    const result = agent.run(env);

    return {
      domain: agent.domain,
      decision: result.decision,
      confidence: result.confidence
    };
  });
}

// =======================
// AGGREGATION ENGINE
// =======================
function aggregate(outputs) {
  const scores = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const o of outputs) {
    const weight = o.confidence || 0.5;
    scores[o.decision] += weight;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// SCORING ENGINE (LEARNING CORE)
// =======================
function calculateScore(agentDecision, finalDecision, confidence) {
  const success = agentDecision === finalDecision;
  const score = success ? confidence : 0;

  return { success, score };
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
// MAIN EXECUTION ENDPOINT
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const agents = await getTenantAgents(tenantId);

    const outputs = executeAgents(agents, env);

    const decision = aggregate(outputs);

    // =======================
    // STORE MAIN RUN
    // =======================
    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision
    });

    // =======================
    // FEEDBACK LOOP (LEARNING)
    // =======================
    for (const o of outputs) {
      const result = calculateScore(
        o.decision,
        decision,
        o.confidence
      );

      await supabase.from("agent_scores").insert({
        tenant_id: tenantId,
        agent_id: o.domain,
        success: result.success,
        score: result.score,
        context: env
      });
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
  console.log("🚀 Operion OS Running (Learning Mode)");
});

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
    run: (env, memory) => {
      const pastHolds = memory.filter(m => m.decision === "HOLD").length;

      return pastHolds > 2
        ? "HOLD"
        : env.weatherRisk === "EXTREME"
        ? "HOLD"
        : "PROCEED";
    }
  },

  {
    agent_id: "aviation_routing",
    domain: "aviation",
    run: (env, memory) => {
      const delayCases = memory.filter(m => m.decision === "DELAY").length;

      return delayCases > 3
        ? "REROUTE"
        : env.congestionRisk === "HIGH"
        ? "DELAY"
        : "PROCEED";
    }
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
// LOAD MEMORY
// =======================
async function loadMemory(tenantId, agentId) {
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .limit(20);

  return data || [];
}

// =======================
// EXECUTION
// =======================
async function executeAgents(env, tenantId) {
  const results = [];

  for (const agent of AGENTS) {
    const memory = await loadMemory(tenantId, agent.agent_id);

    const decision = agent.run(env, memory);

    results.push({
      agent_id: agent.agent_id,
      decision
    });
  }

  return results;
}

// =======================
// AGGREGATION
// =======================
function aggregate(outputs) {
  const scores = {};

  for (const o of outputs) {
    scores[o.decision] = (scores[o.decision] || 0) + 1;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// STORE MEMORY
// =======================
async function storeMemory(tenantId, outputs, env, finalDecision) {
  const records = outputs.map(o => ({
    tenant_id: tenantId,
    agent_id: o.agent_id,
    memory_type: "decision",
    state: env,
    outcome: { decision: o.decision, final: finalDecision },
    usefulness: o.decision === finalDecision ? 1 : 0
  }));

  await supabase.from("agent_memory").insert(records);
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

    const outputs = await executeAgents(env, tenantId);

    const decision = aggregate(outputs);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision
    });

    await storeMemory(tenantId, outputs, env, decision);

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
  console.log("🧠 Operion Distributed Memory Network Running");
});

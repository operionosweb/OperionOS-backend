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
// BASE AGENTS (seed population)
// =======================
const BASE_AGENTS = [
  {
    agent_id: "aviation_basic",
    domain: "aviation",
    logic: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED"
  },
  {
    agent_id: "aviation_routing",
    domain: "aviation",
    logic: (env) =>
      env.weatherRisk === "HIGH"
        ? "REROUTE"
        : env.congestionRisk === "HIGH"
        ? "DELAY"
        : "PROCEED"
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
// LOAD ACTIVE AGENTS
// =======================
async function getActiveAgents(tenantId) {
  const { data } = await supabase
    .from("agent_registry")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (data && data.length > 0) return data;

  // bootstrap system if empty
  const seeded = BASE_AGENTS.map(a => ({
    tenant_id: tenantId,
    agent_id: a.agent_id,
    domain: a.domain,
    logic: { type: "function_seed" },
    performance: 1,
    version: 1
  }));

  await supabase.from("agent_registry").insert(seeded);

  return seeded;
}

// =======================
// EXECUTE AGENTS
// =======================
function runAgent(agent, env) {
  if (agent.agent_id === "aviation_basic") {
    return env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED";
  }

  if (agent.agent_id === "aviation_routing") {
    return env.weatherRisk === "HIGH"
      ? "REROUTE"
      : env.congestionRisk === "HIGH"
      ? "DELAY"
      : "PROCEED";
  }

  return "PROCEED";
}

// =======================
// AGGREGATION
// =======================
function aggregate(outputs) {
  const scores = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const o of outputs) {
    scores[o.decision] += o.performance;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// EVOLUTION RULES
// =======================
function mutateLogic(oldLogic) {
  const mutations = [
    (env) => env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
    (env) => env.congestionRisk === "HIGH" ? "DELAY" : "PROCEED",
    (env) => "PROCEED"
  ];

  return mutations[Math.floor(Math.random() * mutations.length)];
}

// =======================
// EVOLUTION ENGINE
// =======================
async function evolveAgents(tenantId) {
  const { data } = await supabase
    .from("agent_registry")
    .select("*")
    .eq("tenant_id", tenantId);

  if (!data) return;

  const best = data.sort((a, b) => b.performance - a.performance)[0];

  if (!best) return;

  // clone best agent
  const newAgent = {
    tenant_id: tenantId,
    agent_id: best.agent_id + "_v" + (best.version + 1),
    domain: best.domain,
    logic: {
      type: "mutated",
      fn: "adaptive"
    },
    performance: 0.5,
    version: best.version + 1
  };

  await supabase.from("agent_registry").insert(newAgent);
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

    const agents = await getActiveAgents(tenantId);

    const outputs = agents.map(agent => {
      const decision = runAgent(agent, env);

      return {
        agent_id: agent.agent_id,
        decision,
        performance: agent.performance || 1
      };
    });

    const finalDecision = aggregate(outputs);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision: finalDecision
    });

    // evolve system after run
    await evolveAgents(tenantId);

    res.json({
      tenantId,
      env,
      outputs,
      decision: finalDecision
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
app.listen(process.env.PORT || 3000, () => {
  console.log("🧠 Operion Evolution Engine Running");
});

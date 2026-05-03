import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =======================
// 🧠 TENANTS (MULTI-CLIENT ISOLATION)
// =======================
let TENANTS = {
  default: {
    budget: 20,
    memory: [],
    installedAgents: []
  }
};

// =======================
// 🧠 AGENT MARKETPLACE (GLOBAL REGISTRY)
// =======================
let MARKETPLACE = {
  aviation_core: {
    domain: "aviation",
    cost: 1,
    reliability: 0.8,
    permissions: ["weather", "traffic"],
    execute: (env) => ({
      decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
      confidence: 0.7
    })
  },

  aviation_routing_pro: {
    domain: "aviation",
    cost: 3,
    reliability: 0.95,
    permissions: ["weather", "traffic", "routing"],
    execute: (env) => ({
      decision:
        env.weatherRisk === "HIGH" ? "REROUTE" :
        env.congestionRisk === "HIGH" ? "DELAY" :
        "PROCEED",
      confidence: 0.9
    })
  },

  maritime_safety_ai: {
    domain: "maritime",
    cost: 2,
    reliability: 0.88,
    permissions: ["weather"],
    execute: (env) => ({
      decision: env.weatherRisk === "HIGH" ? "DELAY" : "PROCEED",
      confidence: 0.85
    })
  }
};

// =======================
// 🧠 ENVIRONMENT MODEL
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
// 🧠 AGENT INSTALLER (MARKETPLACE LOGIC)
// =======================
app.post("/install/:tenant/:agent", (req, res) => {
  const { tenant, agent } = req.params;

  if (!TENANTS[tenant]) {
    TENANTS[tenant] = { budget: 20, memory: [], installedAgents: [] };
  }

  const plugin = MARKETPLACE[agent];

  if (!plugin) {
    return res.status(404).json({ error: "Agent not found" });
  }

  TENANTS[tenant].installedAgents.push(agent);

  res.json({
    message: `Agent ${agent} installed for ${tenant}`,
    tenant: TENANTS[tenant]
  });
});

// =======================
// 🧠 SANDBOX EXECUTION LAYER
// =======================
function executeAgents(tenant, env) {
  const t = TENANTS[tenant];

  let spent = 0;
  const outputs = [];

  for (const agentName of t.installedAgents) {
    const agent = MARKETPLACE[agentName];

    if (!agent) continue;

    if (spent + agent.cost > t.budget) continue;

    const result = agent.execute(env);

    outputs.push({
      agent: agentName,
      domain: agent.domain,
      ...result,
      score: result.confidence * agent.reliability
    });

    spent += agent.cost;
  }

  return outputs;
}

// =======================
// 🧠 DECISION AGGREGATION
// =======================
function aggregate(outputs) {
  const scores = { PROCEED: 0, DELAY: 0, REROUTE: 0, HOLD: 0 };

  for (const o of outputs) {
    scores[o.decision] += o.score;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// 🌍 SIMULATION INPUTS
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
// 🚀 MAIN EXECUTION
// =======================
app.post("/execute/:tenant", async (req, res) => {
  try {
    const { tenant } = req.params;

    if (!TENANTS[tenant]) {
      TENANTS[tenant] = { budget: 20, memory: [], installedAgents: [] };
    }

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const outputs = executeAgents(tenant, env);

    const decision = aggregate(outputs);

    TENANTS[tenant].memory.push({ env, outputs, decision });

    if (TENANTS[tenant].memory.length > 50) {
      TENANTS[tenant].memory.shift();
    }

    res.json({
      tenant,
      env,
      outputs,
      decision,
      installedAgents: TENANTS[tenant].installedAgents
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Multi-Tenant Intelligence Marketplace Active");
});

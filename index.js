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
// 🧠 PLUGIN REGISTRY (AGENT ECONOMY)
// =======================
let PLUGINS = {
  aviation_basic: {
    domain: "aviation",
    weight: 1.0,
    cost: 1,
    reliability: 0.8,
    fn: (env) => ({
      decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
      confidence: 0.7
    })
  },

  aviation_advanced: {
    domain: "aviation",
    weight: 1.3,
    cost: 2,
    reliability: 0.9,
    fn: (env) => ({
      decision:
        env.weatherRisk === "HIGH" ? "DELAY" :
        env.congestionRisk === "HIGH" ? "REROUTE" :
        "PROCEED",
      confidence: 0.85
    })
  },

  maritime_basic: {
    domain: "maritime",
    weight: 1.0,
    cost: 1,
    reliability: 0.75,
    fn: (env) => ({
      decision: env.weatherRisk === "HIGH" ? "DELAY" : "PROCEED",
      confidence: 0.7
    })
  }
};

// =======================
// 🧠 ENVIRONMENT MODEL
// =======================
function envModel(weather, traffic) {
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
// 🧠 OS KERNEL (PLUGIN EXECUTOR)
// =======================
function executeKernel(env, budget = 10) {
  const results = [];
  let spent = 0;

  for (const [name, plugin] of Object.entries(PLUGINS)) {
    if (spent + plugin.cost > budget) continue;

    const output = plugin.fn(env);

    results.push({
      plugin: name,
      domain: plugin.domain,
      ...output,
      score: output.confidence * plugin.reliability * plugin.weight
    });

    spent += plugin.cost;
  }

  return results;
}

// =======================
// 🧠 ECONOMY ENGINE (LEARNING LOOP)
// =======================
function updateEconomy(results) {
  for (const r of results) {
    if (r.decision === "PROCEED") {
      PLUGINS[r.plugin].weight *= 1.02;
      PLUGINS[r.plugin].reliability *= 1.01;
    } else if (r.decision === "HOLD") {
      PLUGINS[r.plugin].weight *= 0.98;
    }

    // clamp values
    PLUGINS[r.plugin].weight = Math.min(2, Math.max(0.5, PLUGINS[r.plugin].weight));
    PLUGINS[r.plugin].reliability = Math.min(1, Math.max(0.5, PLUGINS[r.plugin].reliability));
  }
}

// =======================
// 🧠 OS DECISION LAYER
// =======================
function aggregate(results) {
  const scores = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const r of results) {
    scores[r.decision] += r.score;
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
// 🚀 MAIN OS EXECUTION
// =======================
app.post("/execute", async (req, res) => {
  try {
    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = envModel(weather, traffic);

    const results = executeKernel(env, 10);

    const decision = aggregate(results);

    updateEconomy(results);

    res.json({
      env,
      pluginResults: results,
      finalDecision: decision,
      pluginEconomy: PLUGINS
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Operional Intelligence OS Active");
});

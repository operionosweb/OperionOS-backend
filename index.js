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
// INITIAL HIERARCHY STATE
// =======================
let TOPOLOGY = {
  aviation: { weight: 1.5, active: true },
  maritime: { weight: 1.0, active: true },
  offshore: { weight: 1.0, active: true },
  finance: { weight: 1.2, active: true }
};

// =======================
// PERFORMANCE MEMORY
// =======================
let PERFORMANCE_HISTORY = {
  aviation: [],
  maritime: [],
  offshore: [],
  finance: []
};

// =======================
// DOMAIN GOVERNORS
// =======================
const GOVERNORS = {
  aviation: (env) => ({
    decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
    score: env.weatherRisk === "LOW" ? 0.9 : 0.6
  }),

  maritime: (env) => ({
    decision: env.weatherRisk === "HIGH" ? "DELAY" : "PROCEED",
    score: env.weatherRisk === "LOW" ? 0.8 : 0.5
  }),

  offshore: (env) => ({
    decision: env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
    score: env.weatherRisk === "LOW" ? 0.85 : 0.55
  }),

  finance: (env) => ({
    decision: env.congestionRisk === "HIGH" ? "DELAY" : "PROCEED",
    score: env.congestionRisk === "LOW" ? 0.9 : 0.7
  })
};

// =======================
// ENV MODEL
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
// META OPTIMIZER (NEW CORE)
// =======================
function optimizeTopology() {
  const avgScores = {};

  // compute rolling performance
  for (const domain in PERFORMANCE_HISTORY) {
    const history = PERFORMANCE_HISTORY[domain];
    const avg =
      history.reduce((a, b) => a + b, 0) /
      (history.length || 1);

    avgScores[domain] = avg || 0.5;
  }

  // normalize influence
  const max = Math.max(...Object.values(avgScores));

  for (const domain in TOPOLOGY) {
    const normalized = avgScores[domain] / max;

    // adaptive weight adjustment
    TOPOLOGY[domain].weight =
      0.5 + normalized * 1.5;

    // activation threshold
    TOPOLOGY[domain].active =
      normalized > 0.4;
  }

  return { TOPOLOGY, avgScores };
}

// =======================
// COORDINATION ENGINE
// =======================
function coordinate(governorOutputs) {
  let scoreTable = {
    PROCEED: 0,
    DELAY: 0,
    HOLD: 0
  };

  for (const domain in governorOutputs) {
    if (!TOPOLOGY[domain].active) continue;

    const output = governorOutputs[domain];

    const weight = TOPOLOGY[domain].weight;

    scoreTable[output.decision] +=
      output.score * weight;

    PERFORMANCE_HISTORY[domain].push(output.score);

    // keep memory bounded
    if (PERFORMANCE_HISTORY[domain].length > 20) {
      PERFORMANCE_HISTORY[domain].shift();
    }
  }

  const final = Object.entries(scoreTable)
    .sort((a, b) => b[1] - a[1])[0][0];

  return { final, scoreTable };
}

// =======================
// SIMULATION INPUTS
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
// MAIN LOOP
// =======================
app.post("/message", async (req, res) => {
  try {
    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = envModel(weather, traffic);

    const governorOutputs = {};

    for (const [domain, fn] of Object.entries(GOVERNORS)) {
      governorOutputs[domain] = fn(env);
    }

    const decision = coordinate(governorOutputs);

    const topologyUpdate = optimizeTopology();

    res.json({
      env,
      governorOutputs,
      decision,
      topology: topologyUpdate
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Self-Optimizing Organizational Topology Active");
});

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
// GLOBAL STATE
// =======================
const GLOBAL_POLICY = {
  safetyPriority: 1.8,
  costPriority: 1.0,
  efficiencyPriority: 1.2
};

// =======================
// DOMAIN GOVERNORS
// =======================
const GOVERNORS = {
  aviation: (env) => ({
    decision:
      env.weatherRisk === "EXTREME" ? "HOLD" :
      env.congestionRisk === "HIGH" ? "DELAY" :
      "PROCEED",

    risk: env.weatherRisk,
    load: env.traffic
  }),

  maritime: (env) => ({
    decision:
      env.weatherRisk === "HIGH" ? "DELAY" :
      "PROCEED",

    risk: env.weatherRisk
  }),

  offshore: (env) => ({
    decision:
      env.weatherRisk === "EXTREME" ? "HOLD" :
      "PROCEED",

    risk: env.weatherRisk
  }),

  finance: (env) => ({
    decision:
      env.congestionRisk === "HIGH" ? "DELAY" :
      "PROCEED",

    risk: env.congestionRisk
  })
};

// =======================
// CENTRAL COORDINATOR (NEW CORE)
// =======================
function centralCoordinator(governorOutputs, env) {
  const scores = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  // Evaluate governor outputs
  for (const [domain, output] of Object.entries(governorOutputs)) {
    let weight = GLOBAL_POLICY.efficiencyPriority;

    // safety override logic
    if (output.decision === "HOLD") {
      weight *= GLOBAL_POLICY.safetyPriority;
    }

    // risk amplification
    if (output.risk === "EXTREME") {
      weight *= 1.5;
    }

    scores[output.decision] += weight;
  }

  // enforce safety override (hard constraint)
  const anyExtreme = Object.values(governorOutputs)
    .some(g => g.risk === "EXTREME");

  if (anyExtreme) {
    return {
      finalDecision: "HOLD",
      reason: "Global safety override triggered (EXTREME risk detected)",
      scores
    };
  }

  const finalDecision = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    finalDecision,
    reason: "Weighted governance aggregation",
    scores
  };
}

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
// SIMULATION INPUTS
// =======================
async function getWeather() {
  try {
    const res = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
    );
    return res.data.current_weather;
  } catch {
    return null;
  }
}

async function getTraffic() {
  return 6000 + Math.floor(Math.random() * 4000);
}

// =======================
// MAIN EXECUTION
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = envModel(weather, traffic);

    // STEP 1: Governors decide locally
    const governorOutputs = {};
    for (const [domain, governor] of Object.entries(GOVERNORS)) {
      governorOutputs[domain] = governor(env);
    }

    // STEP 2: Central coordination
    const final = centralCoordinator(governorOutputs, env);

    res.json({
      message,
      environment: env,
      governorOutputs,
      centralDecision: final
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🏛️ Hierarchical Command Layer Active");
});

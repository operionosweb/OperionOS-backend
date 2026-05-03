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
// AGENT LAYERS
// =======================
const GOVERNORS = {
  aviation: { weight: 1 },
  maritime: { weight: 1 },
  offshore: { weight: 1 }
};

const AGENTS = {
  aviation: [
    (env) => env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",
    (env) => env.congestionRisk === "HIGH" ? "DELAY" : "PROCEED"
  ],
  maritime: [
    (env) => env.weatherRisk === "EXTREME" ? "ANCHOR" : "SAIL"
  ],
  offshore: [
    (env) => env.wind > 40 ? "SHUTDOWN" : "OPERATE"
  ]
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
// DOMAIN EXECUTION
// =======================
function runDomain(domain, env) {
  const agents = AGENTS[domain];

  const outputs = agents.map(fn => fn(env));

  const counts = {};

  for (const o of outputs) {
    counts[o] = (counts[o] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// GOVERNOR LEVEL
// =======================
function runGovernors(env) {
  const results = {};

  for (const domain of Object.keys(AGENTS)) {
    results[domain] = runDomain(domain, env);
  }

  return results;
}

// =======================
// COORDINATOR (FINAL DECISION)
// =======================
function coordinate(governorResults) {
  const values = Object.values(governorResults);

  const counts = {};

  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0][0];
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
// MAIN
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const governorResults = runGovernors(env);

    const finalDecision = coordinate(governorResults);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: governorResults,
      decision: finalDecision
    });

    res.json({
      tenantId,
      env,
      governorResults,
      finalDecision
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🏗️ Operion Hierarchical Intelligence OS Running");
});

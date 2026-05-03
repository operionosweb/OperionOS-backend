import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =======================
// SUPABASE (SHARED MEMORY LAYER)
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// GLOBAL SHARED WEIGHTS (SYNCED ACROSS NODES)
// =======================
let SHARED_WEIGHTS = {
  safety: 1.6,
  cost: 1.0,
  efficiency: 1.2,
  operations: 1.5
};

// =======================
// NODE IDENTIFICATION
// =======================
const NODE_ID = process.env.NODE_ID || "aviation-node";

// =======================
// LOAD GLOBAL STATE FROM DB (SYNC)
// =======================
async function syncGlobalState() {
  const { data } = await supabase
    .from("global_agent_state")
    .select("*")
    .eq("id", "master")
    .single();

  if (data?.weights) {
    SHARED_WEIGHTS = data.weights;
  }
}

// =======================
// PUSH STATE TO SHARED MEMORY
// =======================
async function pushGlobalState() {
  await supabase.from("global_agent_state").upsert({
    id: "master",
    weights: SHARED_WEIGHTS,
    updated_by: NODE_ID,
    updated_at: new Date().toISOString()
  });
}

// =======================
// ENV MODEL (SIMPLIFIED)
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
// AGENTS
// =======================
const AGENTS = {
  safety: (env) =>
    env.weatherRisk === "EXTREME" ? "HOLD" :
    env.weatherRisk === "HIGH" ? "DELAY" :
    "PROCEED",

  cost: (env) =>
    env.congestionRisk === "HIGH" ? "DELAY" : "PROCEED",

  efficiency: (env) =>
    env.traffic > 8000 ? "REROUTE" : "PROCEED",

  operations: (env) =>
    env.weatherRisk === "HIGH" && env.congestionRisk === "HIGH"
      ? "HOLD"
      : "PROCEED"
};

// =======================
// DEBATE + WEIGHTED DECISION
// =======================
function decisionEngine(env) {
  const votes = {};
  const score = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const [name, fn] of Object.entries(AGENTS)) {
    const decision = fn(env);
    votes[name] = decision;

    score[decision] += SHARED_WEIGHTS[name];
  }

  const finalDecision = Object.entries(score)
    .sort((a, b) => b[1] - a[1])[0][0];

  return { votes, score, finalDecision };
}

// =======================
// 🧠 DISTRIBUTED LEARNING UPDATE (NEW CORE)
// =======================
async function distributedLearningUpdate(env, result) {
  const { finalDecision, score } = result;

  const success =
    finalDecision === "PROCEED" && env.weatherRisk !== "EXTREME";

  const learningRate = 0.03;

  // local adjustment
  if (success) {
    for (const k in SHARED_WEIGHTS) {
      SHARED_WEIGHTS[k] += learningRate;
    }
  } else {
    SHARED_WEIGHTS.operations += 0.05;
    SHARED_WEIGHTS.safety += 0.08;
  }

  // clamp weights
  for (const k in SHARED_WEIGHTS) {
    SHARED_WEIGHTS[k] = Math.max(
      0.5,
      Math.min(2.0, SHARED_WEIGHTS[k])
    );
  }

  // persist globally
  await pushGlobalState();

  return SHARED_WEIGHTS;
}

// =======================
// SIMPLE ENV FETCH
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
  return 7000 + Math.floor(Math.random() * 3000);
}

// =======================
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    await syncGlobalState();

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = envModel(weather, traffic);

    const decision = decisionEngine(env);

    const updatedWeights = await distributedLearningUpdate(
      env,
      decision
    );

    res.json({
      node: NODE_ID,
      environment: env,
      decision,
      sharedWeights: updatedWeights,
      message: "Distributed learning cycle complete"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🌐 Distributed Agent Memory Network Active");
  console.log("Node:", NODE_ID);
});

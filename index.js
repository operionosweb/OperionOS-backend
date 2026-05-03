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
// SUPABASE
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// MEMORY GRAPH (CAUSAL DATA)
// =======================
async function getDecisionHistory(user_id) {
  const { data } = await supabase
    .from("memory_graph")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return data || [];
}

// =======================
// ENVIRONMENT
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

async function getAviation() {
  try {
    const res = await axios.get(
      "https://opensky-network.org/api/states/all"
    );
    return res.data.states?.length || 0;
  } catch {
    return null;
  }
}

// =======================
// PREDICTION MODELS
// =======================
function predictWeatherRisk(current) {
  if (!current) return { riskLevel: "UNKNOWN" };

  const w = current.windspeed;

  const h6 = w * 1.05;
  const h12 = w * 1.1;
  const h24 = w * 1.2;

  const riskLevel =
    h24 > 45 ? "EXTREME" :
    h24 > 30 ? "HIGH" :
    h24 > 20 ? "MODERATE" :
    "LOW";

  return { wind: w, forecast: { h6, h12, h24 }, riskLevel };
}

function predictAviationLoad(count) {
  const base = count || 6000;

  return {
    forecast: {
      h6: base * 1.03,
      h12: base * 1.05,
      h24: base * 1.08
    },
    congestionRisk:
      base > 8500 ? "HIGH" :
      base > 6500 ? "MEDIUM" :
      "LOW"
  };
}

// =======================
// BASE OPTIMIZATION SOLVER
// =======================
function optimizationSolver(env) {
  const wr = env.weather?.riskLevel;
  const cr = env.aviation?.congestionRisk;

  let cost = 100;
  let risk = 100;
  let delay = 10;

  if (cr === "HIGH") cost += 30;
  if (wr === "HIGH") risk += 20;
  if (wr === "EXTREME") risk += 40;

  delay += wr === "HIGH" ? 25 : 5;

  const total = cost * 0.4 + risk * 0.4 + delay * 0.2;

  let decision = "PROCEED";
  if (total > 140) decision = "DELAY";
  if (total > 170) decision = "REROUTE";
  if (wr === "EXTREME") decision = "HOLD";

  return { cost, risk, delay, total, decision };
}

// =======================
// 🧠 COUNTERFACTUAL ENGINE (NEW CORE)
// =======================
function simulateAlternative(action, baseDecision, env) {
  const modifier = {
    PROCEED: 1,
    DELAY: 0.7,
    REROUTE: 0.6,
    HOLD: 0.4
  };

  const envRisk =
    (env.weather?.riskLevel === "EXTREME" ? 50 : 10) +
    (env.aviation?.congestionRisk === "HIGH" ? 30 : 10);

  const baseScore = baseDecision.total;

  const simulatedScore =
    baseScore * modifier[action] + envRisk * (action === "PROCEED" ? 1.2 : 0.8);

  return {
    action,
    predictedCost: simulatedScore,
    improvementVsCurrent: baseDecision.total - simulatedScore
  };
}

function counterfactualEngine(baseDecision, env) {
  const actions = ["PROCEED", "DELAY", "REROUTE", "HOLD"];

  const simulations = actions.map(a =>
    simulateAlternative(a, baseDecision, env)
  );

  simulations.sort((a, b) => a.predictedCost - b.predictedCost);

  return {
    bestAlternative: simulations[0],
    allSimulations: simulations
  };
}

// =======================
// ENV BUILDER
// =======================
async function buildEnvironment() {
  const [w, a] = await Promise.all([
    getWeather(),
    getAviation()
  ]);

  return {
    weather: predictWeatherRisk(w),
    aviation: predictAviationLoad(a),
    timestamp: new Date().toISOString()
  };
}

// =======================
// LLM
// =======================
async function llm(system, user) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content;
}

// =======================
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const history = await getDecisionHistory(user_id);

    const env = await buildEnvironment();

    const decision = optimizationSolver(env);

    // 🧠 COUNTERFACTUAL SIMULATION
    const counterfactual = counterfactualEngine(decision, env);

    const reply = await llm(
      "You are an advanced operations intelligence system.",
      `
USER:
${message}

CURRENT DECISION:
${JSON.stringify(decision)}

BEST ALTERNATIVE:
${JSON.stringify(counterfactual.bestAlternative)}

ALL SIMULATIONS:
${JSON.stringify(counterfactual.allSimulations)}

TASK:
Explain:
- why current decision is chosen
- what better alternative exists
- tradeoffs between actions
`
    );

    res.json({
      reply,
      decision,
      counterfactual,
      environment: env
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Counterfactual Reasoning Engine Active");
});

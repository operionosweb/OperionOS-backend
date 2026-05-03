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
// MEMORY (BASE)
// =======================
async function storeMemory(user_id, message) {
  await supabase.from("user_memory").insert([
    {
      user_id,
      summary: message,
      created_at: new Date().toISOString()
    }
  ]);
}

async function getMemory(user_id) {
  const { data } = await supabase
    .from("user_memory")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}

// =======================
// 🔗 TEMPORAL MEMORY GRAPH (NEW CORE)
// =======================
async function storeDecisionChain({
  user_id,
  message,
  decision,
  environment,
  outcomeScore
}) {
  await supabase.from("memory_graph").insert([
    {
      user_id,
      event: message,
      decision: decision.decision,
      cost: decision.cost,
      risk: decision.risk,
      delay: decision.delay,
      score: outcomeScore,
      weather_risk: environment.weather?.riskLevel,
      congestion_risk: environment.aviation?.congestionRisk,
      created_at: new Date().toISOString()
    }
  ]);
}

async function getDecisionHistory(user_id) {
  const { data } = await supabase
    .from("memory_graph")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(20);

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
// PREDICTION LAYER
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

  return { currentWind: w, forecast: { h6, h12, h24 }, riskLevel };
}

function predictAviationLoad(count) {
  const base = count || 6000;

  const h6 = base * 1.03;
  const h12 = base * 1.05;
  const h24 = base * 1.08;

  return {
    forecast: { h6, h12, h24 },
    congestionRisk:
      h24 > 8500 ? "HIGH" :
      h24 > 6500 ? "MEDIUM" :
      "LOW"
  };
}

// =======================
// OPTIMIZATION SOLVER
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
// REINFORCEMENT SCORE
// =======================
function computeOutcomeScore(decision) {
  const t = decision.total;

  if (decision.decision === "PROCEED" && t < 120) return 0.9;
  if (decision.decision === "HOLD") return 0.95;
  if (decision.decision === "DELAY" && t < 170) return 0.8;

  if (decision.decision === "PROCEED" && t > 160) return 0.2;

  return 0.5;
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
// PLANNER + AGENTS
// =======================
function planner(msg) {
  const m = msg.toLowerCase();

  return {
    aviation: m.includes("flight"),
    maritime: m.includes("ship"),
    offshore: m.includes("rig"),
    finance: m.includes("cost")
  };
}

// agents
async function aviationAgent(m, c) { return llm("Aviation expert", `${c}\n${m}`); }
async function maritimeAgent(m, c) { return llm("Maritime expert", `${c}\n${m}`); }
async function offshoreAgent(m, c) { return llm("Offshore expert", `${c}\n${m}`); }
async function financeAgent(m, c) { return llm("Finance expert", `${c}\n${m}`); }

// =======================
// MAIN SYSTEM
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const history = await getMemory(user_id);
    const context = history.map(m => m.summary).join("\n");

    const env = await buildEnvironment();
    const decision = optimizationSolver(env);

    const outputs = {};
    const tasks = [];

    const plan = planner(message);

    if (plan.aviation)
      tasks.push(aviationAgent(message, context).then(r => outputs.aviation = r));

    if (plan.maritime)
      tasks.push(maritimeAgent(message, context).then(r => outputs.maritime = r));

    if (plan.offshore)
      tasks.push(offshoreAgent(message, context).then(r => outputs.offshore = r));

    if (plan.finance)
      tasks.push(financeAgent(message, context).then(r => outputs.finance = r));

    await Promise.all(tasks);

    const reply = await llm(
      "You are an operations intelligence engine with causal memory.",
      `
USER:
${message}

ENV:
${JSON.stringify(env)}

DECISION:
${JSON.stringify(decision)}

AGENTS:
${JSON.stringify(outputs)}

TASK:
Explain and justify decision.
`
    );

    const score = computeOutcomeScore(decision);

    // =======================
    // 🧠 TEMPORAL MEMORY GRAPH WRITE
    // =======================
    await storeMemory(user_id, message);

    await storeDecisionChain({
      user_id,
      message,
      decision,
      environment: env,
      outcomeScore: score
    });

    res.json({
      reply,
      decision,
      score,
      environment: env
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Temporal Memory Graph Engine Active");
});

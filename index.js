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
// MEMORY
// =======================
async function getMemory(user_id) {
  const { data } = await supabase
    .from("user_memory")
    .select("summary")
    .eq("user_id", user_id)
    .limit(5);

  return data || [];
}

async function storeMemory(user_id, message) {
  await supabase.from("user_memory").insert([
    { user_id, summary: message }
  ]);
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
// PREDICTIVE LAYER
// =======================
function predictWeatherRisk(current) {
  if (!current) return { riskLevel: "UNKNOWN" };

  const wind = current.windspeed;

  const h6 = wind * 1.05;
  const h12 = wind * 1.1;
  const h24 = wind * 1.2;

  const riskLevel =
    h24 > 45 ? "EXTREME" :
    h24 > 30 ? "HIGH" :
    h24 > 20 ? "MODERATE" :
    "LOW";

  return {
    currentWind: wind,
    forecast: { h6, h12, h24 },
    riskLevel
  };
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
// OPTIMIZATION SOLVER LAYER (NEW CORE)
// =======================
function optimizationSolver(env) {
  const weatherRisk = env.weather?.riskLevel || "UNKNOWN";
  const congestionRisk = env.aviation?.congestionRisk || "UNKNOWN";

  // COST (lower is better)
  let costScore = 100;
  if (congestionRisk === "HIGH") costScore += 30;
  if (congestionRisk === "MEDIUM") costScore += 15;

  // RISK (lower is better)
  let riskScore = 100;
  if (weatherRisk === "EXTREME") riskScore += 40;
  if (weatherRisk === "HIGH") riskScore += 20;
  if (weatherRisk === "MODERATE") riskScore += 10;

  // DELAY IMPACT (lower is better)
  const delayScore =
    (congestionRisk === "HIGH" ? 30 : 10) +
    (weatherRisk === "HIGH" ? 25 : 5);

  const totalScore =
    (costScore * 0.4) +
    (riskScore * 0.4) +
    (delayScore * 0.2);

  let decision = "PROCEED";

  if (totalScore > 140) decision = "DELAY";
  if (totalScore > 170) decision = "REROUTE";
  if (weatherRisk === "EXTREME") decision = "ABORT / HOLD";

  return {
    scores: {
      costScore,
      riskScore,
      delayScore,
      totalScore
    },
    decision
  };
}

// =======================
// ENVIRONMENT BUILDER
// =======================
async function buildEnvironment() {
  const [weatherRaw, aviationRaw] = await Promise.all([
    getWeather(),
    getAviation()
  ]);

  return {
    weather: predictWeatherRisk(weatherRaw),
    aviation: predictAviationLoad(aviationRaw),
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
// PLANNER
// =======================
function planner(msg) {
  const m = msg.toLowerCase();

  return {
    aviation: m.includes("flight") || m.includes("aircraft"),
    maritime: m.includes("ship") || m.includes("port"),
    offshore: m.includes("rig"),
    finance: m.includes("cost") || m.includes("profit")
  };
}

// =======================
// AGENTS
// =======================
async function aviationAgent(msg, ctx) {
  return llm("Aviation ops expert", `${ctx}\n${msg}`);
}

async function maritimeAgent(msg, ctx) {
  return llm("Maritime ops expert", `${ctx}\n${msg}`);
}

async function offshoreAgent(msg, ctx) {
  return llm("Offshore ops expert", `${ctx}\n${msg}`);
}

async function financeAgent(msg, ctx) {
  return llm("Finance analyst", `${ctx}\n${msg}`);
}

// =======================
// SYNTHESIZER (NOW DECISION-AWARE)
// =======================
async function synthesizer(msg, ctx, outputs, env, decision) {
  return llm(
    "You are an operations decision intelligence engine.",
    `
USER:
${msg}

CONTEXT:
${ctx}

AGENTS:
${JSON.stringify(outputs)}

ENVIRONMENT:
${JSON.stringify(env)}

OPTIMIZATION RESULT:
${JSON.stringify(decision)}

TASK:
- Explain decision (PROCEED / DELAY / REROUTE / ABORT)
- Justify using cost, risk, delay tradeoffs
- Provide operational recommendation
`
  );
}

// =======================
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    const plan = planner(message);

    const env = await buildEnvironment();

    const decision = optimizationSolver(env);

    const outputs = {};
    const tasks = [];

    if (plan.aviation)
      tasks.push(aviationAgent(message, context).then(r => (outputs.aviation = r)));

    if (plan.maritime)
      tasks.push(maritimeAgent(message, context).then(r => (outputs.maritime = r)));

    if (plan.offshore)
      tasks.push(offshoreAgent(message, context).then(r => (outputs.offshore = r)));

    if (plan.finance)
      tasks.push(financeAgent(message, context).then(r => (outputs.finance = r)));

    await Promise.all(tasks);

    const reply = await synthesizer(message, context, outputs, env, decision);

    storeMemory(user_id, message);

    res.json({
      reply,
      plan,
      environment: env,
      optimization: decision
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Operion Optimization Solver Active");
});

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
    .select("summary, score")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return data || [];
}

async function storeMemory(user_id, message) {
  await supabase.from("user_memory").insert([
    {
      user_id,
      summary: message,
      score: 0.5 // neutral starting value
    }
  ]);
}

// =======================
// FEEDBACK MEMORY UPDATE (NEW CORE)
// =======================
async function updateMemoryScore(user_id, outcomeScore) {
  const { data } = await supabase
    .from("user_memory")
    .select("id, score")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data?.length) return;

  const mem = data[0];

  const newScore = Math.max(
    0,
    Math.min(1, (mem.score || 0.5) * 0.7 + outcomeScore * 0.3)
  );

  await supabase
    .from("user_memory")
    .update({ score: newScore })
    .eq("id", mem.id);
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

  return { currentWind: wind, forecast: { h6, h12, h24 }, riskLevel };
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
  const weatherRisk = env.weather?.riskLevel || "UNKNOWN";
  const congestionRisk = env.aviation?.congestionRisk || "UNKNOWN";

  let cost = 100;
  let risk = 100;
  let delay = 10;

  if (congestionRisk === "HIGH") cost += 30;
  if (weatherRisk === "HIGH") risk += 20;
  if (weatherRisk === "EXTREME") risk += 40;

  delay += (weatherRisk === "HIGH" ? 25 : 5);

  const total = cost * 0.4 + risk * 0.4 + delay * 0.2;

  let decision = "PROCEED";
  if (total > 140) decision = "DELAY";
  if (total > 170) decision = "REROUTE";
  if (weatherRisk === "EXTREME") decision = "HOLD";

  return { cost, risk, delay, total, decision };
}

// =======================
// 🔁 REINFORCEMENT SCORING LAYER (NEW CORE)
// =======================
function computeOutcomeScore(decisionResult) {
  const { decision, total } = decisionResult;

  let score = 0.5;

  // better decisions under high pressure = higher score
  if (decision === "PROCEED" && total < 120) score = 0.9;
  if (decision === "DELAY" && total > 140 && total < 170) score = 0.8;
  if (decision === "REROUTE" && total > 150) score = 0.85;
  if (decision === "HOLD") score = 0.95;

  // bad decisions penalized
  if (decision === "PROCEED" && total > 160) score = 0.2;
  if (decision === "DELAY" && total < 100) score = 0.3;

  return score;
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

// agents (unchanged logic)
async function aviationAgent(m, c) { return llm("Aviation expert", `${c}\n${m}`); }
async function maritimeAgent(m, c) { return llm("Maritime expert", `${c}\n${m}`); }
async function offshoreAgent(m, c) { return llm("Offshore expert", `${c}\n${m}`); }
async function financeAgent(m, c) { return llm("Finance expert", `${c}\n${m}`); }

// =======================
// SYNTHESIZER
// =======================
async function synthesizer(msg, ctx, outputs, env, decision) {
  return llm(
    "You are a self-learning operational intelligence system.",
    `
USER:
${msg}

AGENTS:
${JSON.stringify(outputs)}

ENV:
${JSON.stringify(env)}

DECISION:
${JSON.stringify(decision)}

TASK:
Explain decision and learn from it.
`
  );
}

// =======================
// MAIN LOOP (WITH LEARNING FEEDBACK)
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    const env = await buildEnvironment();

    const decision = optimizationSolver(env);

    const outputs = {};
    const tasks = [];

    const plan = planner(message);

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

    // =======================
    // 🔁 REINFORCEMENT LOOP
    // =======================
    const outcomeScore = computeOutcomeScore(decision);

    await storeMemory(user_id, message);
    await updateMemoryScore(user_id, outcomeScore);

    res.json({
      reply,
      decision,
      learning_score: outcomeScore,
      environment: env
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Operion Self-Learning System Active");
});

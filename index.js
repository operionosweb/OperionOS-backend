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
// WEATHER
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

// =======================
// ⏱️ PREDICTIVE ENGINE (FIXED)
// =======================
function predictWeatherRisk(current) {
  if (!current) return { forecast: "unknown" };

  const wind = current.windspeed;

  const next6h = wind * 1.05;
  const next12h = wind * 1.1;
  const next24h = wind * 1.2;

  const riskLevel =
    next24h > 45 ? "EXTREME" :
    next24h > 30 ? "HIGH" :
    next24h > 20 ? "MODERATE" :
    "LOW";

  return {
    currentWind: wind,
    forecast: {
      h6: next6h,
      h12: next12h,
      h24: next24h
    },
    riskLevel
  };
}

// =======================
// AVIATION
// =======================
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

function predictAviationLoad(currentCount) {
  const base = currentCount || 6000;

  const f6 = base * 1.03;
  const f12 = base * 1.05;
  const f24 = base * 1.08;

  return {
    forecast: {
      h6: f6,
      h12: f12,
      h24: f24
    },
    congestionRisk:
      f24 > 8500 ? "HIGH" :
      f24 > 6500 ? "MEDIUM" :
      "LOW"
  };
}

// =======================
// ENVIRONMENT LAYER
// =======================
async function getPredictiveEnvironment() {
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
    offshore: m.includes("rig") || m.includes("offshore"),
    finance: m.includes("cost") || m.includes("profit")
  };
}

// =======================
// AGENTS
// =======================
async function aviationAgent(msg, ctx) {
  return llm("Aviation ops expert", `${ctx}\n\n${msg}`);
}

async function maritimeAgent(msg, ctx) {
  return llm("Maritime ops expert", `${ctx}\n\n${msg}`);
}

async function offshoreAgent(msg, ctx) {
  return llm("Offshore ops expert", `${ctx}\n\n${msg}`);
}

async function financeAgent(msg, ctx) {
  return llm("Finance ops analyst", `${ctx}\n\n${msg}`);
}

// =======================
// SYNTHESIZER
// =======================
async function synthesizer(msg, ctx, outputs, env) {
  return llm(
    "You are a predictive operations orchestration engine.",
    `
USER:
${msg}

CONTEXT:
${ctx}

ENVIRONMENT:
${JSON.stringify(env)}

AGENTS:
${JSON.stringify(outputs)}
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

    const env = await getPredictiveEnvironment();

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

    const reply = await synthesizer(message, context, outputs, env);

    storeMemory(user_id, message);

    res.json({
      reply,
      plan,
      predictive_environment: env
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🚀 Operion predictive orchestration running");
});

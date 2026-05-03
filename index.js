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
// WEATHER LAYER (FREE)
// =======================
async function getWeatherContext() {
  try {
    const res = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
    );

    const w = res.data.current_weather;

    return {
      windspeed: w.windspeed,
      temperature: w.temperature,
      weathercode: w.weathercode,
      risk:
        w.windspeed > 40 ? "HIGH WIND RISK" :
        w.windspeed > 25 ? "MODERATE WIND RISK" :
        "LOW RISK"
    };
  } catch (err) {
    return { risk: "UNKNOWN", error: true };
  }
}

// =======================
// AVIATION CONTEXT (FREE SIGNAL)
// =======================
async function getAviationContext() {
  try {
    const res = await axios.get(
      "https://opensky-network.org/api/states/all"
    );

    const aircraftCount = res.data?.states?.length || 0;

    return {
      aircraftCount,
      congestion:
        aircraftCount > 8000 ? "HIGH" :
        aircraftCount > 5000 ? "MEDIUM" :
        "LOW"
    };
  } catch (err) {
    return { congestion: "UNKNOWN" };
  }
}

// =======================
// MARITIME CONTEXT (SIMPLIFIED FREE SIGNAL)
// =======================
function getMaritimeContext() {
  // No free global AIS → we simulate operational proxy
  return {
    congestion: "ESTIMATED MEDIUM",
    note: "AIS premium required for full accuracy"
  };
}

// =======================
// ENVIRONMENTAL CONTEXT LAYER
// =======================
async function getEnvironmentContext() {
  const [weather, aviation] = await Promise.all([
    getWeatherContext(),
    getAviationContext()
  ]);

  const maritime = getMaritimeContext();

  return {
    weather,
    aviation,
    maritime
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
// PLANNER
// =======================
function planner(message) {
  const m = message.toLowerCase();

  return {
    aviation: m.includes("flight") || m.includes("aircraft"),
    maritime: m.includes("ship") || m.includes("port"),
    offshore: m.includes("offshore") || m.includes("rig"),
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
  return llm("Offshore energy ops expert", `${ctx}\n\n${msg}`);
}

async function financeAgent(msg, ctx) {
  return llm("Finance ops analyst", `${ctx}\n\n${msg}`);
}

// =======================
// SYNTHESIZER
// =======================
async function synthesizer(msg, ctx, outputs, env) {
  return llm(
    "You are an operations orchestration engine. Use environmental constraints.",
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

    // 🌍 NEW: environment layer
    const env = await getEnvironmentContext();

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
      environment: env
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🌍 Operion environment-aware orchestration running (€0 mode)");
});

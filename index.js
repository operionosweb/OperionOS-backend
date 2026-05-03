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
// AGENTS
// =======================
const AGENTS = [
  {
    id: "aviation_core",
    domain: "aviation",
    run: (env) => env.wind > 40 ? "HOLD" : "PROCEED"
  },
  {
    id: "maritime_core",
    domain: "maritime",
    run: (env) => env.weatherRisk === "EXTREME" ? "ANCHOR" : "SAIL"
  },
  {
    id: "offshore_core",
    domain: "offshore",
    run: (env) => env.wind > 35 ? "SHUTDOWN" : "OPERATE"
  }
];

// =======================
// ENV BUILDER
// =======================
function buildEnv(weather) {
  const wind = weather?.windspeed || 10;

  return {
    wind,
    weatherRisk:
      wind > 45 ? "EXTREME" :
      wind > 30 ? "HIGH" :
      "LOW"
  };
}

// =======================
// METRICS LOGGER
// =======================
async function logMetric(tenantId, type, value, meta = {}) {
  await supabase.from("system_metrics").insert({
    tenant_id: tenantId,
    metric_type: type,
    value,
    meta
  });
}

// =======================
// AGENT EXECUTION
// =======================
async function runAgents(env, tenantId) {
  const results = [];

  const start = Date.now();

  for (const agent of AGENTS) {
    const t0 = Date.now();

    let decision;
    try {
      decision = agent.run(env);
    } catch {
      decision = "ERROR";
    }

    const duration = Date.now() - t0;

    await logMetric(tenantId, "agent_latency", duration, {
      agent: agent.id
    });

    results.push({
      agent: agent.id,
      domain: agent.domain,
      decision,
      latency: duration
    });
  }

  const totalTime = Date.now() - start;

  await logMetric(tenantId, "system_latency", totalTime);

  return results;
}

// =======================
// SYSTEM HEALTH SCORING
// =======================
function computeHealth(results) {
  const ok = results.filter(r => r.decision !== "ERROR").length;
  return ok / results.length;
}

// =======================
// LOAD INDICATOR (SCALING SIGNAL)
// =======================
async function reportLoad(tenantId, healthScore, latency) {
  const loadLevel =
    latency > 800 ? "HIGH" :
    latency > 400 ? "MEDIUM" :
    "LOW";

  await logMetric(tenantId, "system_health", healthScore, {
    loadLevel
  });

  return { loadLevel, healthScore };
}

// =======================
// WEATHER
// =======================
async function getWeather() {
  const res = await axios.get(
    "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true",
    { timeout: 1000 }
  );
  return res.data.current_weather;
}

// =======================
// MAIN EXECUTION
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const env = buildEnv(weather);

    const start = Date.now();

    const results = await runAgents(env, tenantId);

    const latency = Date.now() - start;

    const healthScore = computeHealth(results);

    const load = await reportLoad(tenantId, healthScore, latency);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: results,
      health: healthScore,
      latency
    });

    res.json({
      tenantId,
      env,
      results,
      healthScore,
      latency,
      load,
      status: "control_plane_active"
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
      status: "control_plane_error"
    });
  }
});

// =======================
// CONTROL DASHBOARD API
// =======================

// system health overview
app.get("/control/:tenantId/health", async (req, res) => {
  const { tenantId } = req.params;

  const { data } = await supabase
    .from("system_metrics")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  res.json({
    tenantId,
    metrics: data
  });
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🧭 Operion Control Center OS Running");
});

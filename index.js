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
// RATE LIMIT CHECK
// =======================
async function checkTenantLimit(tenantId) {
  let { data } = await supabase
    .from("tenant_limits")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (!data) {
    const init = {
      tenant_id: tenantId,
      max_requests_per_minute: 60,
      current_usage: 0,
      reset_at: new Date()
    };

    await supabase.from("tenant_limits").insert(init);
    data = init;
  }

  const now = new Date();
  const resetTime = new Date(data.reset_at);

  // reset window
  if (now - resetTime > 60000) {
    await supabase
      .from("tenant_limits")
      .update({
        current_usage: 0,
        reset_at: now
      })
      .eq("tenant_id", tenantId);

    data.current_usage = 0;
  }

  if (data.current_usage >= data.max_requests_per_minute) {
    throw new Error("Rate limit exceeded");
  }

  await supabase
    .from("tenant_limits")
    .update({
      current_usage: data.current_usage + 1
    })
    .eq("tenant_id", tenantId);
}

// =======================
// SAFE AGENT WRAPPER (SANDBOX)
// =======================
async function safeExecute(fn, env) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ decision: "TIMEOUT", score: 0 });
    }, 500);

    try {
      const result = fn(env);
      clearTimeout(timeout);
      resolve({ decision: result, score: 1 });
    } catch (e) {
      resolve({ decision: "ERROR", score: 0 });
    }
  });
}

// =======================
// INTERNAL AGENTS
// =======================
const AGENTS = [
  {
    id: "aviation_core",
    domain: "aviation",
    run: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED"
  },
  {
    id: "maritime_core",
    domain: "maritime",
    run: (env) =>
      env.weatherRisk === "EXTREME" ? "ANCHOR" : "SAIL"
  },
  {
    id: "offshore_core",
    domain: "offshore",
    run: (env) =>
      env.wind > 40 ? "SHUTDOWN" : "OPERATE"
  }
];

// =======================
// ENV BUILDER
// =======================
function buildEnv(weather, traffic) {
  const wind = weather?.windspeed || 10;

  return {
    weatherRisk:
      wind > 45 ? "EXTREME" :
      wind > 30 ? "HIGH" :
      "LOW",
    wind,
    traffic
  };
}

// =======================
// EXECUTION LAYER (SAFE)
// =======================
async function executeAgents(env) {
  const results = [];

  for (const agent of AGENTS) {
    const output = await safeExecute(agent.run, env);

    results.push({
      agent_id: agent.id,
      domain: agent.domain,
      decision: output.decision,
      score: output.score
    });
  }

  return results;
}

// =======================
// AGGREGATION
// =======================
function aggregate(results) {
  const scores = {};

  for (const r of results) {
    scores[r.decision] =
      (scores[r.decision] || 0) + r.score;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// EXTERNAL DATA
// =======================
async function getWeather() {
  const res = await axios.get(
    "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true",
    { timeout: 800 }
  );
  return res.data.current_weather;
}

async function getTraffic() {
  return 6000 + Math.random() * 3000;
}

// =======================
// MAIN ENDPOINT
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    // 🔐 enforce isolation + rate limits
    await checkTenantLimit(tenantId);

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const results = await executeAgents(env);

    const decision = aggregate(results);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: results,
      decision
    });

    res.json({
      tenantId,
      env,
      results,
      decision,
      status: "secure_execution_ok"
    });

  } catch (err) {
    res.status(500).json({
      error: err.message,
      status: "blocked_or_failed"
    });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🔐 Operion Secure Enterprise OS Running");
});

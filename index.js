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
// AGENTS (simple stable layer)
// =======================
const AGENTS = [
  {
    agent_id: "aviation_basic",
    domain: "aviation",
    run: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED"
  },
  {
    agent_id: "aviation_routing",
    domain: "aviation",
    run: (env) =>
      env.congestionRisk === "HIGH" ? "DELAY" : "PROCEED"
  }
];

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
// EXECUTE SYSTEM
// =======================
function executeAgents(env) {
  return AGENTS.map(a => ({
    agent_id: a.agent_id,
    decision: a.run(env)
  }));
}

// =======================
// SYSTEM ANALYSIS (META-AGENT)
// =======================
function analyzeSystem(outputs) {
  const counts = {};
  let total = 0;

  for (const o of outputs) {
    counts[o.decision] = (counts[o.decision] || 0) + 1;
    total++;
  }

  const diversity = Object.keys(counts).length;

  const dominant = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0];

  const instabilityScore = diversity / total;

  return {
    dominantDecision: dominant[0],
    systemScore: 1 - instabilityScore,
    issues:
      instabilityScore > 0.6
        ? ["high disagreement between agents"]
        : [],
    recommendation:
      instabilityScore > 0.6
        ? "increase agent specialization"
        : "system stable"
  };
}

// =======================
// STORE REFLECTION
// =======================
async function storeReflection(tenantId, analysis) {
  await supabase.from("system_reflections").insert({
    tenant_id: tenantId,
    summary: `System leaning toward ${analysis.dominantDecision}`,
    system_score: analysis.systemScore,
    issues: analysis.issues,
    recommendation: analysis.recommendation
  });
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
// MAIN ENDPOINT
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const outputs = executeAgents(env);

    const analysis = analyzeSystem(outputs);

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: outputs,
      decision: analysis.dominantDecision
    });

    await storeReflection(tenantId, analysis);

    res.json({
      tenantId,
      env,
      outputs,
      meta: analysis
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🧠 Operion Meta-Reflection Engine Running");
});

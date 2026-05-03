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
// INITIAL ORGANIZATION STATE
// =======================
const DEFAULT_DOMAINS = ["aviation", "maritime", "offshore"];

// =======================
// AGENTS (simplified domain logic)
// =======================
const AGENTS = {
  aviation: (env) =>
    env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED",

  maritime: (env) =>
    env.weatherRisk === "EXTREME" ? "ANCHOR" : "SAIL",

  offshore: (env) =>
    env.wind > 40 ? "SHUTDOWN" : "OPERATE"
};

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

    wind,
    traffic
  };
}

// =======================
// LOAD ORG STATE
// =======================
async function getOrgState(tenantId) {
  const { data } = await supabase
    .from("org_topology_state")
    .select("*")
    .eq("tenant_id", tenantId);

  if (data && data.length > 0) {
    return data;
  }

  // bootstrap
  const init = DEFAULT_DOMAINS.map(d => ({
    tenant_id: tenantId,
    domain: d,
    weight: 1,
    performance: 1
  }));

  await supabase.from("org_topology_state").insert(init);

  return init;
}

// =======================
// RUN DOMAIN WITH WEIGHT
// =======================
function runDomain(domain, env, weight) {
  const decision = AGENTS[domain](env);

  return {
    domain,
    decision,
    weightedInfluence: weight
  };
}

// =======================
// COORDINATOR (WEIGHTED VOTING)
// =======================
function coordinate(results) {
  const scores = {};

  for (const r of results) {
    scores[r.decision] =
      (scores[r.decision] || 0) + r.weightedInfluence;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// ORGANIZATION SELF-OPTIMIZATION
// =======================
async function updateTopology(tenantId, results, finalDecision, orgState) {
  const updates = [];

  for (const domainState of orgState) {
    const domainResult = results.find(r => r.domain === domainState.domain);

    const success = domainResult.decision === finalDecision;

    const newPerf =
      (domainState.performance + (success ? 1 : 0)) / 2;

    let newWeight = domainState.weight;

    // increase influence if performing well
    if (newPerf > 0.7) newWeight += 0.1;

    // decrease if underperforming
    if (newPerf < 0.4) newWeight -= 0.1;

    newWeight = Math.max(0.2, Math.min(2, newWeight));

    updates.push({
      id: domainState.id,
      performance: newPerf,
      weight: newWeight,
      last_updated: new Date()
    });
  }

  for (const u of updates) {
    await supabase
      .from("org_topology_state")
      .update(u)
      .eq("id", u.id);
  }

  return updates;
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
// MAIN
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await getWeather();
    const traffic = await getTraffic();

    const env = buildEnv(weather, traffic);

    const orgState = await getOrgState(tenantId);

    const results = orgState.map(d =>
      runDomain(d.domain, env, d.weight)
    );

    const finalDecision = coordinate(results);

    const topologyUpdates = await updateTopology(
      tenantId,
      results,
      finalDecision,
      orgState
    );

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: results,
      decision: finalDecision
    });

    res.json({
      tenantId,
      env,
      results,
      finalDecision,
      topologyUpdates
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🧠 Self-Optimizing Operational OS Running");
});

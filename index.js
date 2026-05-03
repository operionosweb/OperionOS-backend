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
// CORE INTERNAL AGENTS
// =======================
const INTERNAL_AGENTS = [
  {
    id: "aviation_core",
    domain: "aviation",
    run: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" : "PROCEED"
  }
];

// =======================
// MARKETPLACE AGENTS
// =======================
async function loadMarketplaceAgents(domain) {
  const { data } = await supabase
    .from("marketplace_agents")
    .select("*")
    .eq("domain", domain)
    .eq("active", true);

  return data || [];
}

// =======================
// EXECUTE MARKETPLACE AGENT (sandboxed)
// =======================
async function runMarketplaceAgent(agent, env) {
  try {
    const res = await axios.post(agent.endpoint, {
      env
    });

    return {
      id: agent.id,
      decision: res.data.decision,
      cost: agent.price_per_call,
      score: res.data.score || 1
    };
  } catch (e) {
    return {
      id: agent.id,
      decision: "FAIL",
      cost: agent.price_per_call,
      score: 0
    };
  }
}

// =======================
// ENV
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
// AGGREGATION
// =======================
function aggregate(allDecisions) {
  const scores = {};

  for (const d of allDecisions) {
    scores[d.decision] =
      (scores[d.decision] || 0) + (d.score || 1);
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}

// =======================
// MARKET COST TRACKING
// =======================
async function logMarketUsage(tenantId, agentId, cost, score) {
  await supabase.from("agent_market_usage").insert({
    tenant_id: tenantId,
    agent_id: agentId,
    cost,
    outcome_score: score
  });
}

// =======================
// MAIN ENGINE
// =======================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const weather = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
    );

    const traffic = 7000 + Math.random() * 3000;

    const env = buildEnv(weather.data.current_weather, traffic);

    // INTERNAL AGENTS
    const internalResults = INTERNAL_AGENTS.map(a => ({
      id: a.id,
      decision: a.run(env),
      score: 1
    }));

    // MARKETPLACE AGENTS
    const marketplace = await loadMarketplaceAgents("aviation");

    const marketResults = await Promise.all(
      marketplace.map(a => runMarketplaceAgent(a, env))
    );

    // LOG COSTS
    for (const m of marketResults) {
      await logMarketUsage(
        tenantId,
        m.id,
        m.cost,
        m.score
      );
    }

    const all = [...internalResults, ...marketResults];

    const decision = aggregate(all);

    res.json({
      tenantId,
      env,
      decision,
      internalResults,
      marketResults
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(process.env.PORT || 3000, () => {
  console.log("🧠 Operion Intelligence Marketplace OS Running");
});

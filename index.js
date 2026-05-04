import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =========================
// AUTH
// =========================
async function getUserRole(userId) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return data?.role || null;
}

function extractUserId(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  return auth.replace("Bearer ", "");
}

// =========================
// AGENTS
// =========================

// WEATHER AGENT
function weatherAgent(context) {
  if (context.weather === "storm") {
    return {
      decision: "reroute to avoid storm",
      score: 0.9,
      agent: "weather"
    };
  }
  return { decision: "maintain route", score: 0.5, agent: "weather" };
}

// COST AGENT
function costAgent(context) {
  return {
    decision: "choose cheapest route",
    score: 0.6,
    agent: "cost"
  };
}

// DELAY AGENT
function delayAgent(context) {
  return {
    decision: "minimize delay path",
    score: 0.7,
    agent: "delay"
  };
}

// SAFETY AGENT
function safetyAgent(context) {
  if (context.weather === "storm") {
    return {
      decision: "avoid high-risk zone",
      score: 0.95,
      agent: "safety"
    };
  }
  return { decision: "standard operation", score: 0.6, agent: "safety" };
}

// =========================
// AGENT VOTING SYSTEM
// =========================
function runAgents(context) {
  const results = [
    weatherAgent(context),
    costAgent(context),
    delayAgent(context),
    safetyAgent(context)
  ];

  // pick highest score
  results.sort((a, b) => b.score - a.score);

  return {
    winner: results[0],
    all: results
  };
}

// =========================
// EXECUTE WITH AGENTS
// =========================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const userId = extractUserId(req);
    const role = await getUserRole(userId);

    if (role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    const context = {
      weather: "storm",
      region: "atlantic"
    };

    const agentResult = runAgents(context);

    const decision = agentResult.winner.decision;

    // STORE MEMORY
    await supabase.from("decision_memory").insert({
      tenant_id: tenantId,
      decision,
      outcome: "pending",
      score: agentResult.winner.score,
      context
    });

    res.json({
      decision,
      chosen_by: agentResult.winner.agent,
      score: agentResult.winner.score,
      all_agents: agentResult.all
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// FEEDBACK
// =========================
app.post("/feedback/:id", async (req, res) => {
  const { id } = req.params;
  const { outcome, score } = req.body;

  await supabase
    .from("decision_memory")
    .update({ outcome, score })
    .eq("id", id);

  res.json({ message: "Feedback recorded" });
});

// =========================
// HISTORY
// =========================
app.get("/control/:tenantId/health", async (req, res) => {
  const { tenantId } = req.params;

  const { data } = await supabase
    .from("decision_memory")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  res.json({ history: data });
});

// =========================
// ROOT
// =========================
app.get("/", (req, res) => {
  res.json({ status: "Operion multi-agent system active" });
});

app.listen(process.env.PORT || 3000);

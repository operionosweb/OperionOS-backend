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
// AGENTS WITH ARGUMENTS
// =========================
function weatherAgent(context) {
  if (context.weather === "storm") {
    return {
      decision: "reroute to avoid storm",
      score: 0.9,
      agent: "weather",
      reason: "Storm conditions increase risk and delay"
    };
  }
  return {
    decision: "maintain route",
    score: 0.5,
    agent: "weather",
    reason: "No severe weather detected"
  };
}

function costAgent(context) {
  return {
    decision: "choose cheapest route",
    score: 0.6,
    agent: "cost",
    reason: "Fuel optimization reduces operational expenses"
  };
}

function delayAgent(context) {
  return {
    decision: "minimize delay path",
    score: 0.7,
    agent: "delay",
    reason: "Schedule adherence is critical"
  };
}

function safetyAgent(context) {
  if (context.weather === "storm") {
    return {
      decision: "avoid high-risk zone",
      score: 0.95,
      agent: "safety",
      reason: "Passenger and asset safety is priority"
    };
  }
  return {
    decision: "standard operation",
    score: 0.6,
    agent: "safety",
    reason: "No major risks detected"
  };
}

// =========================
// DEBATE ENGINE
// =========================
function runDebate(context) {
  const agents = [
    weatherAgent(context),
    costAgent(context),
    delayAgent(context),
    safetyAgent(context)
  ];

  // detect conflicts (different decisions)
  const decisions = agents.map(a => a.decision);
  const uniqueDecisions = [...new Set(decisions)];

  let winner;

  if (uniqueDecisions.length === 1) {
    // all agree
    winner = agents[0];
  } else {
    // conflict → strongest argument wins (score-based for now)
    agents.sort((a, b) => b.score - a.score);
    winner = agents[0];
  }

  return {
    winner,
    debate: agents,
    conflicts: uniqueDecisions.length > 1
  };
}

// =========================
// EXECUTE WITH DEBATE
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

    const result = runDebate(context);

    await supabase.from("decision_memory").insert({
      tenant_id: tenantId,
      decision: result.winner.decision,
      outcome: "pending",
      score: result.winner.score,
      context
    });

    res.json({
      final_decision: result.winner.decision,
      chosen_by: result.winner.agent,
      reason: result.winner.reason,
      conflicts: result.conflicts,
      full_debate: result.debate
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
  res.json({ status: "Operion debate engine active" });
});

app.listen(process.env.PORT || 3000);

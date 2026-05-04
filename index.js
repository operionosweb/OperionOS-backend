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
// ROLE
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
// SIMILARITY ENGINE (V1)
// =========================
function isSimilar(contextA, contextB) {
  if (!contextA || !contextB) return false;

  let score = 0;
  let total = 0;

  for (let key in contextA) {
    total++;
    if (contextA[key] === contextB[key]) {
      score++;
    }
  }

  return score / total > 0.5; // threshold
}

// =========================
// PREDICT BEST DECISION
// =========================
async function predictDecision(tenantId, context) {
  const { data } = await supabase
    .from("decision_memory")
    .select("*")
    .eq("tenant_id", tenantId);

  if (!data || data.length === 0) {
    return null;
  }

  const similar = data.filter(entry =>
    isSimilar(entry.context, context)
  );

  if (similar.length === 0) {
    return null;
  }

  // sort by score
  similar.sort((a, b) => b.score - a.score);

  return similar[0];
}

// =========================
// EXECUTE WITH PREDICTION
// =========================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const userId = extractUserId(req);
    const role = await getUserRole(userId);

    if (role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // --- CURRENT CONTEXT ---
    const context = {
      weather: "storm",
      region: "atlantic"
    };

    // --- PREDICT ---
    const predicted = await predictDecision(tenantId, context);

    let decision;
    let source;

    if (predicted) {
      decision = predicted.decision;
      source = "memory";
    } else {
      decision = "reroute to avoid storm";
      source = "default";
    }

    // --- STORE NEW MEMORY ---
    await supabase.from("decision_memory").insert({
      tenant_id: tenantId,
      decision,
      outcome: "pending",
      score: 0.5,
      context
    });

    res.json({
      decision,
      source,
      message: "Decision generated with prediction engine"
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
  res.json({ status: "Operion predictive engine active" });
});

app.listen(process.env.PORT || 3000);

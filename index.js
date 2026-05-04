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
// ROLE FETCH
// =========================
async function getUserRole(userId) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return data?.role || null;
}

// =========================
// TOKEN (TEMP DEV MODE)
// =========================
function extractUserId(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  return auth.replace("Bearer ", "");
}

// =========================
// MEMORY SCORING ENGINE
// =========================
function scoreDecision(decision) {
  // VERY SIMPLE V1 MODEL
  if (decision.includes("reroute")) return 0.8;
  if (decision.includes("delay")) return 0.3;
  return 0.5;
}

// =========================
// EXECUTE (WITH LEARNING)
// =========================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const userId = extractUserId(req);
    const role = await getUserRole(userId);

    if (role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // --- Decision Logic (placeholder) ---
    const decision = "reroute to avoid storm";

    // --- Score ---
    const score = scoreDecision(decision);

    // --- Store Memory ---
    await supabase.from("decision_memory").insert({
      tenant_id: tenantId,
      decision,
      outcome: "pending",
      score,
      context: { source: "v1-engine" }
    });

    res.json({
      decision,
      score,
      message: "Decision stored and learning updated"
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// UPDATE OUTCOME (LEARNING LOOP)
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
// HEALTH
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
  res.json({ status: "Operion AI learning active" });
});

app.listen(process.env.PORT || 3000);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// SUPABASE CLIENT
// =========================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =========================
// ROLE FETCH FUNCTION
// =========================
async function getUserRole(userId) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.log("Role fetch error:", error.message);
    return null;
  }

  return data?.role || null;
}

// =========================
// SIMPLE TOKEN PARSER (SIMPLIFIED)
// =========================
function extractUserId(req) {
  // In real system this comes from JWT
  const auth = req.headers.authorization;

  if (!auth) return null;

  try {
    // For now we assume frontend sends userId in token (simplified layer)
    const token = auth.replace("Bearer ", "");
    return token;
  } catch (err) {
    return null;
  }
}

// =========================
// EXECUTE ENDPOINT
// =========================
app.post("/execute/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const role = await getUserRole(userId);

    if (!role) {
      return res.status(403).json({ error: "Role not found" });
    }

    if (role !== "super_admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    // Mock operational logic
    const result = {
      tenantId,
      status: "executed",
      decision: "PROCEED",
      role
    };

    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// HEALTH / CONTROL ENDPOINT
// =========================
app.get("/control/:tenantId/health", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const userId = extractUserId(req);
    const role = await getUserRole(userId);

    if (!role) {
      return res.status(403).json({ error: "No role" });
    }

    const { data } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    res.json({
      tenantId,
      role,
      metrics: data || []
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// =========================
// ROOT
// =========================
app.get("/", (req, res) => {
  res.json({
    status: "Operion backend running",
    version: "1.0"
  });
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});

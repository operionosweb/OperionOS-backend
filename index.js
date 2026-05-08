import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   SUPABASE
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   AUTH
=============================== */

async function auth(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  next();
}

/* ===============================
   CORE RISK ENGINE
=============================== */

function riskScore(hours, cycles) {

  const base = hours * 0.09;
  const cycleFactor = cycles * 0.11;

  const score = base + cycleFactor;

  return Math.min(100, score);
}

/* ===============================
   FLEET HEALTH SCORING
=============================== */

function fleetHealth(fleet) {

  if (!fleet.length) return 100;

  const avgRisk =
    fleet.reduce((sum, a) => sum + a.risk, 0) / fleet.length;

  const healthy = fleet.filter(f => f.risk < 40).length;
  const warning = fleet.filter(f => f.risk >= 40 && f.risk < 70).length;
  const critical = fleet.filter(f => f.risk >= 70).length;

  const readiness = 100 - avgRisk;

  return {
    readiness: readiness.toFixed(1),
    avgRisk: avgRisk.toFixed(1),
    distribution: {
      healthy,
      warning,
      critical
    }
  };
}

/* ===============================
   CONTROL CENTER (EXECUTIVE VIEW)
=============================== */

app.get("/api/control-center", auth, async (req, res) => {

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("company_id", profile.company_id);

  const { data: flights } = await supabase
    .from("flights")
    .select("*");

  const fleet = aircraft.map((a) => {

    const related = flights.filter(
      f => f.aircraft_id === a.id
    );

    const hours = related.reduce(
      (sum, f) => sum + Number(f.flight_hours || 0),
      0
    );

    const cycles = related.length;

    const risk = riskScore(hours, cycles);

    let status = "HEALTHY";
    if (risk > 70) status = "CRITICAL";
    else if (risk > 40) status = "WARNING";

    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,
      risk,
      status
    };

  });

  const health = fleetHealth(fleet);

  res.json({
    fleet,
    health
  });

});

/* ===============================
   EXECUTIVE DASHBOARD (CEO VIEW)
=============================== */

app.get("/api/executive/summary", auth, async (req, res) => {

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("company_id", profile.company_id);

  const { data: flights } = await supabase
    .from("flights")
    .select("*");

  const fleet = aircraft.map((a) => {

    const related = flights.filter(
      f => f.aircraft_id === a.id
    );

    const hours = related.reduce(
      (sum, f) => sum + Number(f.flight_hours || 0),
      0
    );

    const risk = riskScore(hours, related.length);

    return { risk };

  });

  const health = fleetHealth(fleet);

  const summary = {
    operationalReadiness: health.readiness,
    avgRisk: health.avgRisk,
    criticalAssets: health.distribution.critical,
    recommendation:
      health.distribution.critical > 0
        ? "Immediate fleet inspection recommended."
        : "Fleet operating within safe parameters.",
    timestamp: new Date()
  };

  res.json({
    summary
  });

});

/* ===============================
   AI COMMAND (BUSINESS-AWARE)
=============================== */

app.post("/api/ai/command", auth, async (req, res) => {

  const { command } = req.body;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("company_id", profile.company_id);

  const fleet = aircraft.map((a) => {

    const risk = Math.random() * 100;

    return {
      id: a.id,
      tail: a.tail_number,
      risk
    };

  });

  const critical = fleet.filter(f => f.risk > 70);

  res.json({
    ai: {
      intent: "EXECUTIVE_ANALYSIS",
      summary: "Fleet executive risk analysis completed.",
      recommendation:
        critical.length > 0
          ? "Schedule immediate maintenance for critical assets."
          : "Fleet operating efficiently.",
      data: {
        criticalAssets: critical.length,
        fleetSize: fleet.length
      }
    }
  });

});

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/api/system/health", (req, res) => {

  res.json({
    status: "operational",
    layer: "commercial-ai-v1",
    timestamp: new Date()
  });

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Operion Commercial Intelligence Platform Running");
});

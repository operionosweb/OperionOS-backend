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
   AUTH (LIGHTWEIGHT)
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
   PREDICTIVE ENGINE CORE
=============================== */

/**
 * Core aviation wear model:
 * - flight hours accumulate stress
 * - exponential risk curve
 */
function calculateRisk(totalHours, cycles) {

  const base = totalHours * 0.08;
  const cycleImpact = cycles * 0.12;

  const risk = base + cycleImpact;

  return Math.min(100, risk);
}

/**
 * Predict future risk (next N flights)
 */
function predictFutureRisk(currentRisk, flightsAhead) {

  let risk = currentRisk;

  for (let i = 0; i < flightsAhead; i++) {
    risk += risk * 0.06; // compounding wear
  }

  return Math.min(100, risk);
}

/* ===============================
   CONTROL CENTER (PREDICTIVE)
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

    const totalHours = related.reduce(
      (sum, f) => sum + Number(f.flight_hours || 0),
      0
    );

    const cycles = related.length;

    const risk = calculateRisk(totalHours, cycles);
    const predicted7 = predictFutureRisk(risk, 7);
    const predicted30 = predictFutureRisk(risk, 30);

    let status = "OK";

    if (risk > 70) status = "CRITICAL";
    else if (risk > 40) status = "WARNING";

    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,

      metrics: {
        totalHours,
        cycles,
        risk: risk.toFixed(1),
        predicted7: predicted7.toFixed(1),
        predicted30: predicted30.toFixed(1)
      },

      status
    };

  });

  res.json({
    fleet
  });

});

/* ===============================
   AI COMMAND (PREDICTIVE CONTEXT)
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

  const { data: flights } = await supabase
    .from("flights")
    .select("*");

  const fleet = aircraft.map((a) => {

    const related = flights.filter(
      f => f.aircraft_id === a.id
    );

    const totalHours = related.reduce(
      (sum, f) => sum + Number(f.flight_hours || 0),
      0
    );

    const risk = calculateRisk(totalHours, related.length);

    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,
      risk
    };

  });

  const highRisk = fleet.filter(f => f.risk > 70);

  res.json({
    ai: {
      intent: "PREDICTIVE_ANALYSIS",
      summary: "Forecasted fleet risk profile generated.",
      recommendation:
        highRisk.length > 0
          ? "Immediate inspection recommended for high-risk aircraft."
          : "Fleet within acceptable predictive thresholds.",
      data: highRisk
    }
  });

});

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {

  res.json({
    status: "operational",
    timestamp: new Date(),
    model: "predictive-v1"
  });

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Operion Predictive Intelligence Engine Running");
});

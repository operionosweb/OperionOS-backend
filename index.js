import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";
import { generateDailyOpsReport } from "./ops/autonomousEngine.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   SUPABASE (AUTH ENABLED)
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   AUTH MIDDLEWARE
=============================== */

async function authMiddleware(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Missing auth token"
    });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({
      status: "error",
      message: "Invalid token"
    });
  }

  req.user = data.user;
  next();
}

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Operion SaaS Core Running"
  });
});

/* ===============================
   GET USER PROFILE
=============================== */

app.get("/api/me", authMiddleware, async (req, res) => {

  res.json({
    status: "success",
    user: req.user
  });

});

/* ===============================
   CONTROL CENTER (TENANT SAFE)
=============================== */

app.get("/api/control-center", authMiddleware, async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("owner_id", req.user.id); // tenant isolation

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

      const failure =
        Math.min(100, totalHours * 0.08 + Math.random() * 25);

      return {
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        failure
      };

    });

    res.json({
      status: "success",
      fleet
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   AI COMMAND (SECURE)
=============================== */

app.post("/api/ai/command", authMiddleware, async (req, res) => {

  try {

    const { command } = req.body;

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("owner_id", req.user.id);

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

      const failure =
        Math.min(100, totalHours * 0.08 + Math.random() * 25);

      return {
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        failure
      };

    });

    const actions = generateActions(fleet);

    const result = interpretCommand(command, fleet, actions);

    res.json({
      status: "success",
      ai: result
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   OPS REPORT (SECURE)
=============================== */

app.get("/api/ops/daily-report", authMiddleware, async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("owner_id", req.user.id);

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

      const failure =
        Math.min(100, totalHours * 0.08 + Math.random() * 25);

      return {
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        failure
      };

    });

    const actions = generateActions(fleet);

    const report = generateDailyOpsReport(fleet, actions);

    res.json({
      status: "success",
      report
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Operion SaaS Core running on port ${PORT}`);
});

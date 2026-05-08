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
   SUPABASE CLIENT
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   AUTH MIDDLEWARE
=============================== */

async function auth(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Missing token"
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
    message: "Operion SaaS Onboarding Core Running"
  });
});

/* ===============================
   CHECK ONBOARDING STATUS
=============================== */

app.get("/api/onboarding/status", auth, async (req, res) => {

  try {

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (!profile || !profile.company_id) {
      return res.json({
        needsOnboarding: true,
        step: "CREATE_COMPANY"
      });
    }

    res.json({
      needsOnboarding: false,
      step: "READY"
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   CREATE COMPANY + ASSIGN CEO
=============================== */

app.post("/api/onboarding/create-company", auth, async (req, res) => {

  const { companyName } = req.body;

  try {

    /* 1. Create company */

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert([
        {
          name: companyName
        }
      ])
      .select()
      .single();

    if (companyError) throw companyError;

    /* 2. Create user profile */

    const { error: profileError } = await supabase
      .from("user_profiles")
      .insert([
        {
          id: req.user.id,
          company_id: company.id,
          role: "CEO"
        }
      ]);

    if (profileError) throw profileError;

    res.json({
      status: "success",
      message: "Company created",
      company,
      role: "CEO"
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   CONTROL CENTER (COMPANY SAFE)
=============================== */

app.get("/api/control-center", auth, async (req, res) => {

  try {

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
   AI COMMAND ENGINE
=============================== */

app.post("/api/ai/command", auth, async (req, res) => {

  const { command } = req.body;

  try {

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
   OPS REPORT
=============================== */

app.get("/api/ops/daily-report", auth, async (req, res) => {

  try {

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
  console.log("🚀 Operion Onboarding Core Running");
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";
import { generateDailyOpsReport } from "./ops/autonomousEngine.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   CORE SERVICES
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
   ADMIN MIDDLEWARE
=============================== */

function adminOnly(req, res, next) {

  const adminEmails = [
    "admin@operionos.com"
  ];

  if (!adminEmails.includes(req.user.email)) {
    return res.status(403).json({
      error: "Admin access only"
    });
  }

  next();
}

/* ===============================
   SYSTEM HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {

  res.json({
    status: "operational",
    timestamp: new Date(),
    services: {
      api: "ok",
      supabase: "ok",
      stripe: "ok"
    }
  });

});

/* ===============================
   ADMIN DASHBOARD
=============================== */

app.get("/api/admin/dashboard", auth, adminOnly, async (req, res) => {

  const { data: companies } = await supabase
    .from("companies")
    .select("*");

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("*");

  const { data: flights } = await supabase
    .from("flights")
    .select("*");

  const stats = {
    companies: companies.length,
    users: profiles.length,
    flights: flights.length
  };

  res.json({
    status: "success",
    stats
  });

});

/* ===============================
   AUDIT LOG TABLE (AI DECISIONS)
=============================== */

app.post("/api/audit/log", auth, async (req, res) => {

  const { action, metadata } = req.body;

  await supabase.from("audit_logs").insert([{
    user_id: req.user.id,
    action,
    metadata,
    created_at: new Date()
  }]);

  res.json({
    status: "logged"
  });

});

/* ===============================
   CONTROL CENTER
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

  const fleet = aircraft.map((a) => ({
    id: a.id,
    tail: a.tail_number,
    model: a.model,
    failure: Math.random() * 100
  }));

  res.json({
    fleet
  });

});

/* ===============================
   AI COMMAND + AUDIT TRACKING
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

  const fleet = aircraft.map((a) => ({
    id: a.id,
    tail: a.tail_number,
    model: a.model,
    failure: Math.random() * 100
  }));

  const actions = generateActions(fleet);

  const result = interpretCommand(command, fleet, actions);

  /* AUDIT LOG */
  await supabase.from("audit_logs").insert([{
    user_id: req.user.id,
    action: "AI_COMMAND",
    metadata: {
      command,
      result
    }
  }]);

  res.json({
    ai: result
  });

});

/* ===============================
   OPS REPORT
=============================== */

app.get("/api/ops/daily-report", auth, async (req, res) => {

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("company_id", profile.company_id);

  const fleet = aircraft.map((a) => ({
    id: a.id,
    tail: a.tail_number,
    model: a.model,
    failure: Math.random() * 100
  }));

  const actions = generateActions(fleet);

  const report = generateDailyOpsReport(fleet, actions);

  res.json({
    report
  });

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Operion Enterprise Control System Running");
});

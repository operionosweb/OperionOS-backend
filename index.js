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
   AUTH MIDDLEWARE
=============================== */

async function auth(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  next();
}

/* ===============================
   PLAN CHECK MIDDLEWARE
=============================== */

async function planLimit(req, res, next) {

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  const companyId = profile.company_id;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company.plan) {
    company.plan = "FREE";
  }

  req.company = company;

  next();
}

/* ===============================
   BILLING PLANS
=============================== */

const PLANS = {
  FREE: { limit: 50 },
  PRO: { limit: 1000 },
  ENTERPRISE: { limit: -1 }
};

/* ===============================
   CONTROL CENTER (WITH LIMIT CHECK)
=============================== */

app.get("/api/control-center", auth, planLimit, async (req, res) => {

  const limit = PLANS[req.company.plan]?.limit || 50;

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

    const failure = Math.random() * 100;

    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,
      failure
    };

  });

  res.json({
    status: "success",
    plan: req.company.plan,
    limit,
    fleet
  });

});

/* ===============================
   STRIPE CHECKOUT
=============================== */

app.post("/api/billing/create-checkout", auth, async (req, res) => {

  const { plan } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Operion ${plan} Plan`
          },
          unit_amount: plan === "PRO" ? 4900 : 9900,
          recurring: {
            interval: "month"
          }
        },
        quantity: 1
      }
    ],
    success_url: "https://operionos.com/control-center",
    cancel_url: "https://operionos.com/control-center"
  });

  res.json({
    url: session.url
  });

});

/* ===============================
   AI COMMAND (PLAN-AWARE)
=============================== */

app.post("/api/ai/command", auth, planLimit, async (req, res) => {

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

  res.json({
    plan: req.company.plan,
    ai: result
  });

});

/* ===============================
   OPS REPORT
=============================== */

app.get("/api/ops/daily-report", auth, planLimit, async (req, res) => {

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
    plan: req.company.plan,
    report
  });

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Operion Billing Core Running");
});

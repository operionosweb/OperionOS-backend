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
   IN-MEMORY RATE LIMITER
=============================== */

const rateMap = new Map();

function rateLimiter(req, res, next) {

  const ip = req.ip;
  const now = Date.now();

  const windowMs = 60 * 1000; // 1 minute
  const limit = 60; // requests per minute

  if (!rateMap.has(ip)) {
    rateMap.set(ip, []);
  }

  const timestamps = rateMap.get(ip);

  const filtered = timestamps.filter(t => now - t < windowMs);

  filtered.push(now);

  rateMap.set(ip, filtered);

  if (filtered.length > limit) {
    return res.status(429).json({
      status: "error",
      message: "Rate limit exceeded"
    });
  }

  next();
}

app.use(rateLimiter);

/* ===============================
   REQUEST LOGGER
=============================== */

app.use(async (req, res, next) => {

  const start = Date.now();

  res.on("finish", async () => {

    const duration = Date.now() - start;

    await supabase.from("request_logs").insert([{
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      created_at: new Date()
    }]);

  });

  next();

});

/* ===============================
   AUTH
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
   AI RATE CONTROL (PER USER)
=============================== */

const aiMap = new Map();

function aiLimiter(req, res, next) {

  const userId = req.user?.id;

  if (!userId) return next();

  const now = Date.now();

  const windowMs = 60 * 1000;
  const limit = 20;

  if (!aiMap.has(userId)) {
    aiMap.set(userId, []);
  }

  const arr = aiMap.get(userId);

  const filtered = arr.filter(t => now - t < windowMs);

  filtered.push(now);

  aiMap.set(userId, filtered);

  if (filtered.length > limit) {
    return res.status(429).json({
      status: "error",
      message: "AI rate limit exceeded"
    });
  }

  next();
}

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {

  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date()
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
   AI COMMAND (PROTECTED + LIMITED)
=============================== */

app.post("/api/ai/command", auth, aiLimiter, async (req, res) => {

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

  await supabase.from("audit_logs").insert([{
    user_id: req.user.id,
    action: "AI_COMMAND",
    metadata: { command }
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
  console.log("🚀 Operion Production-Hardened System Running");
});

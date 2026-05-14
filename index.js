import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

import { logAudit } from "./db.js";
import { extractContract } from "./aiEngine.js";
import {
  createContractVersion,
  diffClauses,
  calculateRiskDelta
} from "./contractVersionEngine.js";

dotenv.config();

const app = express();

/* ===============================
   SUPABASE
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   MIDDLEWARE
=============================== */

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion v2 - Contracts + Versioning Active"
  });
});

/* ===============================
   AUTH LOGIN
=============================== */

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required"
      });
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      return res.status(401).json({
        error: error.message
      });
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ===============================
   AUTH MIDDLEWARE
=============================== */

async function auth(req, res, next) {
  try {
    const token =
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const { data, error } =
      await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = data.user;
    next();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth error" });
  }
}

/* ===============================
   PROFILE
=============================== */

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Profile not found");
  }

  return data;
}

/* ===============================
   CONTROL CENTER
=============================== */

app.get("/api/control-center", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    const companyId = profile.company_id;

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", companyId);

    const { data: flights } = await supabase
      .from("flights")
      .select("*")
      .eq("company_id", companyId);

    const fleet = [];

    for (const a of aircraft || []) {
      const related = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const hours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const cycles = related.length;

      const risk = Math.min(
        100,
        hours * 0.08 + cycles * 0.12
      );

      fleet.push({
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        utilization: { hours, cycles },
        risk
      });
    }

    res.json({ fleet });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Control center failed" });
  }
});

/* ===============================
   CONTRACT EXTRACTION
=============================== */

app.post("/api/contracts/extract", auth, extractContract);

/* ===============================
   CONTRACT VERSIONING (NEW CORE)
=============================== */

app.post("/api/contracts/version", auth, async (req, res) => {
  try {
    const {
      file_id,
      clauses,
      risk_score,
      previous_version
    } = req.body;

    const profile = await getProfile(req.user.id);

    const version = await createContractVersion({
      supabase,
      file_id,
      company_id: profile.company_id,
      clauses,
      risk_score,
      user_id: req.user.id
    });

    let diff = null;
    let riskDelta = null;

    if (previous_version) {
      diff = diffClauses(
        previous_version.clauses,
        clauses
      );

      riskDelta = calculateRiskDelta(
        previous_version.risk_score,
        risk_score
      );
    }

    res.json({
      success: true,
      version,
      diff,
      riskDelta
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Versioning failed"
    });
  }
});

/* ===============================
   MAINTENANCE SCHEDULE
=============================== */

app.get("/api/maintenance/schedule", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);

    const { data } = await supabase
      .from("maintenance_schedule")
      .select("*")
      .eq("company_id", profile.company_id);

    res.json({ schedule: data });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Schedule fetch failed" });
  }
});

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    version: "contracts + versioning v3"
  });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion running on ${PORT}`);
});

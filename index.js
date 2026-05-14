import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

import { logAudit } from "./db.js";
import { getContractDashboard } from "./contractDashboardEngine.js";

dotenv.config();

const app = express();

/* ===============================
   SUPABASE CLIENT (SAFE MODE)
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   MIDDLEWARE
=============================== */

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Contracts Engine Live",
    layer: "AI + Pipeline + Versioning + Insights API",
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
        error: "Email and password required",
      });
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      return res.status(401).json({
        error: error.message,
      });
    }

    await logAudit({
      user_id: data.user.id,
      company_id: null,
      action: "USER_LOGIN",
      entity_type: "auth",
      metadata: { email },
    });

    res.json({
      success: true,
      session: data.session,
      user: data.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Login server error",
    });
  }
});

/* ===============================
   AUTH MIDDLEWARE
=============================== */

async function auth(req, res, next) {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Authentication error" });
  }
}

/* ===============================
   USER PROFILE
=============================== */

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("User profile not found");
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

    await logAudit({
      user_id: req.user.id,
      company_id: companyId,
      action: "CONTROL_CENTER_VIEW",
      entity_type: "control_center",
    });

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

      const baseRisk = hours * 0.08 + cycles * 0.12;

      const city = related[0]?.destination || "London";

      const weather = await fetchWeather(city);

      const totalRisk = Math.min(
        100,
        baseRisk + weatherImpact(weather)
      );

      fleet.push({
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        risk: totalRisk,
        maintenance: estimateMaintenance(totalRisk),
        weather: {
          city,
          condition: weather?.weather?.[0]?.main || "Unknown",
        },
      });
    }

    res.json({ fleet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Control center error" });
  }
});

/* ===============================
   MAINTENANCE GENERATE
=============================== */

app.post("/api/maintenance/generate", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    const companyId = profile.company_id;

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", companyId);

    const schedule = [];

    for (const a of aircraft || []) {
      const risk = Math.random() * 100;
      const plan = estimateMaintenance(risk);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + plan.daysUntilDue);

      const item = {
        aircraft_id: a.id,
        company_id: companyId,
        maintenance_type: plan.type,
        predicted_due_hours: Math.floor(Math.random() * 500),
        predicted_due_date: dueDate,
        estimated_cost: plan.cost,
      };

      await supabase.from("maintenance_schedule").insert([item]);

      schedule.push(item);
    }

    res.json({
      status: "success",
      generated: schedule.length,
      schedule,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Maintenance generation failed",
    });
  }
});

/* ===============================
   MAINTENANCE SCHEDULE
=============================== */

app.get("/api/maintenance/schedule", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    const companyId = profile.company_id;

    const { data } = await supabase
      .from("maintenance_schedule")
      .select("*")
      .eq("company_id", companyId);

    res.json({ schedule: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Schedule fetch failed" });
  }
});

/* ===============================
   INSIGHTS API LAYER
=============================== */

/* DASHBOARD */
app.get("/api/contracts/:id/dashboard", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);

    const result = await getContractDashboard({
      supabase,
      contract_id: req.params.id,
      company_id: profile.company_id,
      user_id: req.user.id,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dashboard fetch failed" });
  }
});

/* RISK TIMELINE */
app.get("/api/contracts/:id/risk-timeline", auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from("contract_versions")
      .select("id, created_at, overall_risk")
      .eq("contract_id", req.params.id)
      .order("created_at", { ascending: true });

    res.json({
      contract_id: req.params.id,
      timeline: (data || []).map((v) => ({
        version_id: v.id,
        date: v.created_at,
        risk: v.overall_risk || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Risk timeline fetch failed" });
  }
});

/* RED FLAGS */
app.get("/api/contracts/:id/red-flags", auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from("contract_versions")
      .select("*")
      .eq("contract_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const clauses = data?.clauses || [];

    const flags = clauses
      .filter((c) => (c.risk_score || 0) >= 70)
      .map((c) => ({
        clause: c.title,
        risk: c.risk_score,
        reason: c.risk_reason || "High risk clause",
      }));

    res.json({
      contract_id: req.params.id,
      red_flags: flags,
      total: flags.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Red flags fetch failed" });
  }
});

/* EXECUTIVE SUMMARY */
app.get(
  "/api/contracts/:id/executive-summary",
  auth,
  async (req, res) => {
    try {
      const { data } = await supabase
        .from("contract_versions")
        .select("*")
        .eq("contract_id", req.params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const risk = data?.overall_risk || 0;

      res.json({
        contract_id: req.params.id,
        summary: data?.summary || "",
        risk,
        severity:
          risk > 80
            ? "CRITICAL"
            : risk > 60
            ? "HIGH"
            : risk > 40
            ? "MEDIUM"
            : "LOW",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Executive summary failed" });
    }
  }
);

/* ===============================
   UTILITIES
=============================== */

function estimateMaintenance(risk) {
  if (risk > 80)
    return { type: "HEAVY_CHECK", cost: 180000, daysUntilDue: 7 };
  if (risk > 60)
    return { type: "ENGINE_INSPECTION", cost: 75000, daysUntilDue: 14 };
  if (risk > 40)
    return { type: "PREVENTIVE_CHECK", cost: 25000, daysUntilDue: 30 };
  return { type: "ROUTINE_MONITORING", cost: 5000, daysUntilDue: 90 };
}

function weatherImpact(weather) {
  if (!weather) return 0;

  let risk = 0;
  const main = weather.weather?.[0]?.main || "";

  if (main.includes("Thunderstorm")) risk += 25;
  if (main.includes("Rain")) risk += 10;
  if (main.includes("Snow")) risk += 18;

  if ((weather.wind?.speed || 0) > 15) risk += 10;

  return risk;
}

async function fetchWeather(city) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}`;
    const res = await axios.get(url);
    return res.data;
  } catch {
    return null;
  }
}

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Backend Running On Port ${PORT}`);
});

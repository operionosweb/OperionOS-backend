import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { logAudit } from "./db.js";
import { extractContract } from "./aiEngine.js";

dotenv.config();

const app = express();

/* ===============================
   SUPABASE (SAFE MODE)
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   REQUEST LOGGER
=============================== */

app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

/* ===============================
   CORS
=============================== */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ===============================
   OPTIONS
=============================== */

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Backend Running",
  });
});

/* ===============================
   LOGIN
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

    // AUDIT LOG
    try {
      const { data: profile } =
        await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

      await logAudit({
        user_id: data.user.id,
        company_id: profile?.company_id || null,
        action: "USER_LOGIN",
        entity_type: "auth",
        metadata: { email },
      });
    } catch (auditErr) {
      console.error("Audit login failed");
      console.error(auditErr.message);
    }

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
    const token =
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        error: "Missing token",
      });
    }

    const { data, error } =
      await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    req.user = data.user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Authentication error",
    });
  }
}

/* ===============================
   PROFILE
=============================== */

async function getProfile(userId) {
  const { data, error } =
    await supabase
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
   RISK ENGINE
=============================== */

function aircraftRisk(hours, cycles) {
  return Math.min(100, hours * 0.08 + cycles * 0.12);
}

/* ===============================
   WEATHER IMPACT
=============================== */

function weatherImpact(weather) {
  if (!weather) return 0;

  let risk = 0;

  const main = weather.weather?.[0]?.main || "";

  if (main.includes("Thunderstorm")) risk += 25;
  if (main.includes("Rain")) risk += 10;
  if (main.includes("Snow")) risk += 18;

  const wind = weather.wind?.speed || 0;

  if (wind > 15) risk += 10;

  return risk;
}

/* ===============================
   WEATHER API
=============================== */

async function fetchWeather(city) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;

    const url =
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;

    const response = await axios.get(url);

    return response.data;
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

/* ===============================
   MAINTENANCE ENGINE
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

/* ===============================
   CONTRACT AI ENDPOINT (NEW)
=============================== */

app.post("/api/contracts/extract", auth, extractContract);

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

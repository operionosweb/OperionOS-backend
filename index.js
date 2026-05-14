import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

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
    status: "Operion Core v2 Running"
  });
});

/* ===============================
   AUTH
=============================== */

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      success: true,
      user: data.user,
      session: data.session
    });

  } catch (err) {
    res.status(500).json({ error: "Login failed" });
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

  } catch {
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
   RISK ENGINE
=============================== */

function aircraftRisk(hours, cycles) {
  return Math.min(100, hours * 0.08 + cycles * 0.12);
}

/* ===============================
   WEATHER
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

async function fetchWeather(city) {
  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}`;

    const res = await axios.get(url);
    return res.data;
  } catch {
    return null;
  }
}

/* ===============================
   CONTROL CENTER (REAL v2)
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
        f => f.aircraft_id === a.id
      );

      const hours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const cycles = related.length;

      const baseRisk = aircraftRisk(hours, cycles);

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

        utilization: {
          hours,
          cycles
        },

        risk: totalRisk,

        weather: {
          city,
          condition: weather?.weather?.[0]?.main || "Unknown"
        }
      });
    }

    res.json({ fleet });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Control center failed" });
  }
});

/* ===============================
   MAINTENANCE (SAFE READ ONLY)
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
    res.status(500).json({ error: "Schedule fetch failed" });
  }
});

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    version: "v2-core"
  });
});

/* ===============================
   START
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Core v2 running on ${PORT}`);
});

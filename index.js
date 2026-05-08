import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

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
   AUTH
=============================== */

async function auth(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      error: "Missing token"
    });
  }

  const { data, error } =
    await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({
      error: "Invalid token"
    });
  }

  req.user = data.user;

  next();
}

/* ===============================
   WEATHER RISK MODEL
=============================== */

function weatherImpact(weather) {

  if (!weather) return 0;

  let risk = 0;

  const main = weather.weather?.[0]?.main || "";

  if (main.includes("Thunderstorm")) risk += 25;
  if (main.includes("Rain")) risk += 12;
  if (main.includes("Snow")) risk += 18;

  const wind = weather.wind?.speed || 0;

  if (wind > 15) risk += 10;
  if (wind > 25) risk += 20;

  return risk;
}

/* ===============================
   AIRCRAFT BASE RISK
=============================== */

function aircraftRisk(hours, cycles) {

  const score =
    hours * 0.08 +
    cycles * 0.12;

  return Math.min(100, score);
}

/* ===============================
   FETCH WEATHER
=============================== */

async function fetchWeather(city) {

  try {

    const apiKey =
      process.env.OPENWEATHER_API_KEY;

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
   CONTROL CENTER
=============================== */

app.get("/api/control-center", auth, async (req, res) => {

  const { data: profile } =
    await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

  const { data: aircraft } =
    await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", profile.company_id);

  const { data: flights } =
    await supabase
      .from("flights")
      .select("*");

  const fleet = [];

  for (const a of aircraft) {

    const related =
      flights.filter(
        f => f.aircraft_id === a.id
      );

    const hours =
      related.reduce(
        (sum, f) =>
          sum + Number(f.flight_hours || 0),
        0
      );

    const cycles = related.length;

    const baseRisk =
      aircraftRisk(hours, cycles);

    const city =
      related[0]?.destination || "London";

    const weather =
      await fetchWeather(city);

    const weatherRisk =
      weatherImpact(weather);

    const totalRisk =
      Math.min(
        100,
        baseRisk + weatherRisk
      );

    let status = "HEALTHY";

    if (totalRisk > 70) {
      status = "CRITICAL";
    } else if (totalRisk > 40) {
      status = "WARNING";
    }

    fleet.push({

      id: a.id,
      tail: a.tail_number,
      model: a.model,

      risk: totalRisk,

      weather: {
        city,
        condition:
          weather?.weather?.[0]?.main || "Unknown",
        wind:
          weather?.wind?.speed || 0
      },

      status
    });

  }

  res.json({
    fleet
  });

});

/* ===============================
   AI ALERTS
=============================== */

app.get("/api/alerts", auth, async (req, res) => {

  const alerts = [
    {
      severity: "HIGH",
      message:
        "Storm conditions increasing fleet operational risk."
    },
    {
      severity: "MEDIUM",
      message:
        "Crosswind exposure detected on active routes."
    }
  ];

  res.json({
    alerts
  });

});

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {

  res.json({
    status: "operational",
    layer: "weather-intelligence-v1",
    timestamp: new Date()
  });

});

/* ===============================
   START SERVER
=============================== */

const PORT =
  process.env.PORT || 4000;

app.listen(PORT, () => {

  console.log(
    "🚀 Operion Weather Intelligence Running"
  );

});

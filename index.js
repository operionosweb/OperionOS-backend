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
    status: "Operion Backend Stable Core Running",
    version: "v1-core-safe"
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
    res.status(500).json({ error: "Auth error" });
  }
}

/* ===============================
   PROFILE HELPER
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
   CONTROL CENTER (SAFE VERSION)
=============================== */

app.get("/api/control-center", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", profile.company_id);

    res.json({
      fleet: (aircraft || []).map(a => ({
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        status: "OK"
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Control center failed"
    });
  }
});

/* ===============================
   MAINTENANCE SCHEDULE (SAFE READ)
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
    res.status(500).json({
      error: "Schedule fetch failed"
    });
  }
});

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    version: "v1-core-safe"
  });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion running on port ${PORT}`);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

/* ===============================
   COPILOT ENGINE
=============================== */

import { generateContractCopilot } from "./contractCopilotEngine.js";

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
    layer: "AI + Pipeline + Versioning + Copilot",
  });
});

/* ===============================
   AUTH
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
   PROFILE
=============================== */

async function getProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) throw new Error("User profile not found");
  return data;
}

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    layer: "contracts-copilot-v1",
    timestamp: new Date(),
  });
});

/* ===============================
   CONTRACT COPILOT API
=============================== */

app.get("/api/contracts/:id/copilot", auth, async (req, res) => {
  try {
    const contract_id = req.params.id;

    const { data: latest, error } = await supabase
      .from("contract_versions")
      .select("*")
      .eq("contract_id", contract_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !latest) {
      return res.status(404).json({
        error: "Contract not found",
      });
    }

    const copilot = await generateContractCopilot({
      contract: latest,
    });

    res.json({
      contract_id,
      copilot,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Copilot generation failed",
    });
  }
});

/* ===============================
   CONTROL CENTER (OPTIONAL BASIC VIEW)
=============================== */

app.get("/api/control-center", auth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*")
      .eq("company_id", profile.company_id);

    const { data: flights } = await supabase
      .from("flights")
      .select("*")
      .eq("company_id", profile.company_id);

    const fleet = [];

    for (const a of aircraft || []) {
      const related = (flights || []).filter(
        (f) => f.aircraft_id === a.id
      );

      const hours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const cycles = related.length;

      const risk = Math.min(100, hours * 0.08 + cycles * 0.12);

      fleet.push({
        id: a.id,
        tail: a.tail_number,
        model: a.model,
        risk,
      });
    }

    res.json({ fleet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Control center error" });
  }
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Backend Running On Port ${PORT}`);
});

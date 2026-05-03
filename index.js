import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// SUPABASE CLIENT
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// JWT VERIFY (SUPABASE)
// =======================
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/keys`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, getKey, {}, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }

    req.user = decoded;
    next();
  });
}

// =======================
// ROLE CHECK
// =======================
async function getUserRole(userId) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data?.role;
}

// =======================
// MOCK WEATHER (placeholder)
// =======================
async function getWeather() {
  try {
    const res = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
    );
    return res.data.current_weather;
  } catch {
    return { windspeed: 10 };
  }
}

// =======================
// ENV BUILDER
// =======================
function buildEnv(weather) {
  return {
    wind: weather?.windspeed || 10,
    risk:
      weather?.windspeed > 40
        ? "HIGH"
        : weather?.windspeed > 25
        ? "MEDIUM"
        : "LOW"
  };
}

// =======================
// AGENT ENGINE (SIMPLIFIED)
// =======================
function runAgents(env) {
  return [
    {
      agent: "aviation_core",
      decision: env.wind > 35 ? "HOLD" : "PROCEED"
    },
    {
      agent: "maritime_core",
      decision: env.wind > 40 ? "ANCHOR" : "SAIL"
    }
  ];
}

// =======================
// 🔐 SECURE EXECUTE ENDPOINT
// =======================
app.post("/execute/:tenantId", verifyToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user.sub;

    const role = await getUserRole(userId);

    // 🔐 ONLY SUPER ADMIN CAN RUN SYSTEM
    if (role !== "super_admin") {
      return res.status(403).json({
        error: "Access denied (requires super_admin role)"
      });
    }

    const weather = await getWeather();
    const env = buildEnv(weather);

    const results = runAgents(env);

    const decision =
      results.find(r => r.agent === "aviation_core")?.decision;

    await supabase.from("agent_runs").insert({
      tenant_id: tenantId,
      input: env,
      output: results,
      decision
    });

    res.json({
      tenantId,
      env,
      results,
      decision,
      status: "secure_execution_success"
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// =======================
// CONTROL PANEL HEALTH
// =======================
app.get("/control/:tenantId/health", verifyToken, async (req, res) => {
  const { tenantId } = req.params;
  const userId = req.user.sub;

  const role = await getUserRole(userId);

  if (!role) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const { data } = await supabase
    .from("agent_runs")
    .select("*")

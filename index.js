import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

/* ===============================
   IMPORT ALL ENGINES
=============================== */

import { generateAircraftTransition } from "./aircraftTransitionEngine.js";
import { generateAviationFinancialStressTest } from "./aviationFinancialStressTestEngine.js";
import { generateDecisionOS } from "./decisionOS.js";

dotenv.config();

const app = express();

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

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Decision OS Live",
    layer: "Unified Aviation Intelligence System"
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
    res.status(500).json({ error: "Auth failed" });
  }
}

/* ===============================
   GET CONTRACT
=============================== */

async function getLatestContract(contract_id) {
  const { data, error } = await supabase
    .from("contract_versions")
    .select("*")
    .eq("contract_id", contract_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error("Contract not found");

  return data;
}

/* ===============================
   DECISION OS ENDPOINT
=============================== */

app.get("/api/contracts/:id/decision", auth, async (req, res) => {

  try {

    const contract = await getLatestContract(req.params.id);

    // ===========================
    // PARALLEL ENGINE EXECUTION
    // ===========================

    const [
      stressTest,
      transition
    ] = await Promise.all([
      generateAviationFinancialStressTest({ contract }),
      generateAircraftTransition({ contract })
    ]);

    // ===========================
    // DECISION OS LAYER
    // ===========================

    const decision = await generateDecisionOS({
      contract,
      stressTest,
      transition
    });

    res.json({
      contract_id: req.params.id,
      decision
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Decision OS failed"
    });
  }
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion Decision OS running on port ${PORT}`);
});

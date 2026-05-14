import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import {
  generateAviationFinancialStressTest
} from "./aviationFinancialStressTestEngine.js";

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
    status: "Operion Aviation Intelligence Live",
    layer: "Financial Stress Test Engine"
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

  if (error || !data) {
    throw new Error("Contract not found");
  }

  return data;

}

/* ===============================
   STRESS TEST ENDPOINT
=============================== */

app.get("/api/contracts/:id/stress-test", auth, async (req, res) => {

  try {

    const contract = await getLatestContract(req.params.id);

    const result = await generateAviationFinancialStressTest({
      contract
    });

    res.json({
      contract_id: req.params.id,
      stress_test: result
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Stress test failed"
    });

  }

});

/* ===============================
   START
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Operion running on port ${PORT}`);
});

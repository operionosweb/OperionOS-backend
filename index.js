import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

/* ===============================
   AI ENGINES
=============================== */

import {
  generateContractCopilot
} from "./contractCopilotEngine.js";

import {
  generateNegotiationSimulation
} from "./contractNegotiationSimulator.js";

import {
  generateBenchmarkAnalysis
} from "./contractBenchmarkEngine.js";

import {
  generateRiskScoring
} from "./contractRiskScoringEngine.js";

import {
  generateExecutiveDashboard
} from "./executiveDashboardEngine.js";

import {
  generateContractRedlines
} from "./contractRedlineEngine.js";

import {
  generateMaintenanceReserveAnalysis
} from "./maintenanceReserveEngine.js";

import {
  generateFleetEconomics
} from "./fleetEconomicsEngine.js";

import {
  generateLeaseReturnSimulation
} from "./leaseReturnSimulator.js";

import {
  generateLLPForecast
} from "./engineLLPForecastingEngine.js";

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

app.use((req, res, next) => {

  console.log(
    `➡️ ${req.method} ${req.url}`
  );

  next();

});

app.use(
  cors({
    origin: "*",

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {

  res.json({
    status:
      "Operion Aviation Intelligence Live",

    layer:
      "AI + Lease Intelligence + LLP Forecasting"
  });

});

/* ===============================
   AUTH
=============================== */

async function auth(req, res, next) {

  try {

    const token =
      req.headers.authorization?.replace(
        "Bearer ",
        ""
      );

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

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error:
        "Authentication failed"
    });

  }

}

/* ===============================
   HEALTH
=============================== */

app.get(
  "/api/system/health",
  (req, res) => {

    res.json({
      status: "operational",

      layer:
        "aviation-intelligence-v6",

      timestamp: new Date()
    });

  }
);

/* ===============================
   GET LATEST CONTRACT
=============================== */

async function getLatestContract(contract_id) {

  const {
    data: latest,
    error
  } =
    await supabase
      .from("contract_versions")
      .select("*")
      .eq(
        "contract_id",
        contract_id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(1)
      .single();

  if (error || !latest) {

    throw new Error(
      "Contract not found"
    );

  }

  return latest;

}

/* ===============================
   LLP FORECAST
=============================== */

app.get(
  "/api/contracts/:id/llp-forecast",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const forecast =
        await generateLLPForecast({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        forecast
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "LLP forecasting failed"
      });

    }

  }
);

/* ===============================
   START SERVER
=============================== */

const PORT =
  process.env.PORT || 4000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 Operion running on port ${PORT}`
    );

  }
);

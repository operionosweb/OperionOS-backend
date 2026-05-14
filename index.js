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
      "Operion Executive Intelligence Live",

    layer:
      "AI + Copilot + Negotiation + Benchmark + Risk + Executive Dashboard + Redline Engine"
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
        "executive-intelligence-v2",

      timestamp: new Date()
    });

  }
);

/* ===============================
   GET LATEST CONTRACT VERSION
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
   COPILOT
=============================== */

app.get(
  "/api/contracts/:id/copilot",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const copilot =
        await generateContractCopilot({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        copilot
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Copilot generation failed"
      });

    }

  }
);

/* ===============================
   NEGOTIATION
=============================== */

app.get(
  "/api/contracts/:id/negotiation",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const negotiation =
        await generateNegotiationSimulation({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        negotiation
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Negotiation generation failed"
      });

    }

  }
);

/* ===============================
   BENCHMARK
=============================== */

app.get(
  "/api/contracts/:id/benchmark",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const benchmark =
        await generateBenchmarkAnalysis({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        benchmark
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Benchmark generation failed"
      });

    }

  }
);

/* ===============================
   RISK
=============================== */

app.get(
  "/api/contracts/:id/risk",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const risk =
        await generateRiskScoring({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        risk
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Risk scoring failed"
      });

    }

  }
);

/* ===============================
   REDLINES
=============================== */

app.get(
  "/api/contracts/:id/redlines",
  auth,
  async (req, res) => {

    try {

      const latest =
        await getLatestContract(
          req.params.id
        );

      const redlines =
        await generateContractRedlines({
          contract: latest
        });

      res.json({
        contract_id:
          req.params.id,

        redlines
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Redline generation failed"
      });

    }

  }
);

/* ===============================
   EXECUTIVE DASHBOARD
=============================== */

app.get(
  "/api/executive/dashboard",
  auth,
  async (req, res) => {

    try {

      const {
        data: contracts
      } =
        await supabase
          .from("contract_versions")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      const dashboard =
        await generateExecutiveDashboard({
          contracts:
            contracts || []
        });

      res.json({
        dashboard
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error:
          "Executive dashboard failed"
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

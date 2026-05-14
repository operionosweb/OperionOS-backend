import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

/* ===============================
   AI ENGINES
=============================== */

import { generateContractCopilot } from "./contractCopilotEngine.js";
import { generateNegotiationSimulation } from "./contractNegotiationSimulator.js";

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

app.use(express.json());

/* ===============================
   ROOT
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "Operion Contracts Engine Live",
    layer:
      "AI + Pipeline + Versioning + Copilot + Negotiation",
  });
});

/* ===============================
   AUTH MIDDLEWARE
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
      error: "Authentication failed",
    });
  }
}

/* ===============================
   HEALTH
=============================== */

app.get("/api/system/health", (req, res) => {
  res.json({
    status: "operational",
    layer: "contracts-intelligence-v4",
    timestamp: new Date(),
  });
});

/* ===============================
   CONTRACT COPILOT
=============================== */

app.get(
  "/api/contracts/:id/copilot",
  auth,
  async (req, res) => {
    try {
      const contract_id = req.params.id;

      const { data: latest, error } =
        await supabase
          .from("contract_versions")
          .select("*")
          .eq("contract_id", contract_id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .single();

      if (error || !latest) {
        return res.status(404).json({
          error: "Contract not found",
        });
      }

      const copilot =
        await generateContractCopilot({
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
  }
);

/* ===============================
   NEGOTIATION SIMULATOR
=============================== */

app.get(
  "/api/contracts/:id/negotiation",
  auth,
  async (req, res) => {
    try {
      const contract_id = req.params.id;

      const { data: latest, error } =
        await supabase
          .from("contract_versions")
          .select("*")
          .eq("contract_id", contract_id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .single();

      if (error || !latest) {
        return res.status(404).json({
          error: "Contract not found",
        });
      }

      const negotiation =
        await generateNegotiationSimulation({
          contract: latest,
        });

      res.json({
        contract_id,
        negotiation,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error:
          "Negotiation simulation failed",
      });
    }
  }
);

/* ===============================
   START SERVER
=============================== */

const PORT =
  process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Operion running on port ${PORT}`
  );
});

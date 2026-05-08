import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";
import { generateDailyOpsReport } from "./ops/autonomousEngine.js";

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
   HEALTH
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Operion AI Copilot vFinal Running"
  });
});

/* ===============================
   SHARED FLEET BUILDER
=============================== */

async function buildFleet() {

  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("*");

  const { data: flights } = await supabase
    .from("flights")
    .select("*");

  return aircraft.map((a) => {

    const related = flights.filter(
      f => f.aircraft_id === a.id
    );

    const totalHours = related.reduce(
      (sum, f) => sum + Number(f.flight_hours || 0),
      0
    );

    const failure =
      Math.min(100, totalHours * 0.08 + Math.random() * 25);

    return {
      id: a.id,
      tail: a.tail_number,
      model: a.model,
      failure
    };

  });
}

/* ===============================
   CONTROL CENTER
=============================== */

app.get("/api/control-center", async (req, res) => {

  try {

    const fleet = await buildFleet();

    res.json({
      status: "success",
      fleet
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   AI COMMAND
=============================== */

app.post("/api/ai/command", async (req, res) => {

  try {

    const { command } = req.body;

    const fleet = await buildFleet();

    const actions = generateActions(fleet);

    const result = interpretCommand(
      command,
      fleet,
      actions
    );

    res.json({
      status: "success",
      command,
      ai: result
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   ACTION ENGINE
=============================== */

app.get("/api/actions", async (req, res) => {

  try {

    const fleet = await buildFleet();

    const actions = generateActions(fleet);

    res.json({
      status: "success",
      actions
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   AUTONOMOUS OPS REPORT
=============================== */

app.get("/api/ops/daily-report", async (req, res) => {

  try {

    const fleet = await buildFleet();

    const actions = generateActions(fleet);

    const report = generateDailyOpsReport(fleet, actions);

    res.json({
      status: "success",
      report
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   🧠 AI COPILOT (NEW CORE ENDPOINT)
=============================== */

app.get("/api/ai/copilot", async (req, res) => {

  try {

    const fleet = await buildFleet();

    const actions = generateActions(fleet);

    const report = generateDailyOpsReport(fleet, actions);

    /* ===============================
       DECISION ENGINE
    =============================== */

    const critical = report.riskGroups.critical.length;
    const high = report.riskGroups.high.length;

    let priorityDecision = "";
    let operationalMode = "";

    if (critical > 0) {
      operationalMode = "EMERGENCY";
      priorityDecision =
        "Ground critical aircraft immediately and trigger inspections.";
    } else if (high > 3) {
      operationalMode = "ELEVATED";
      priorityDecision =
        "Increase maintenance scheduling and reduce flight load.";
    } else {
      operationalMode = "NORMAL";
      priorityDecision =
        "Continue standard operations with monitoring.";
    }

    /* ===============================
       FINAL COPILOT OUTPUT
    =============================== */

    res.json({
      status: "success",

      copilot: {
        operationalMode,

        executiveSummary: report.executiveSummary,

        priorityDecision,

        metrics: report.metrics,

        topRisks: report.riskGroups.critical.slice(0, 5),

        predictedFailures: report.predictedFailures.slice(0, 5),

        recommendedActions: report.priorityActions.slice(0, 5)
      }
    });

  } catch (err) {

    res.status(500).json({
      status: "error",
      message: err.message
    });

  }

});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Operion AI Copilot running on port ${PORT}`);
});

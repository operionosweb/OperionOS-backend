import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";

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
   SIMPLE MEMORY STORE (TEMP)
=============================== */

const sessions = {};

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Operion Chat Ops Backend Running"
  });
});

/* ===============================
   CONTROL CENTER (UNCHANGED CORE)
=============================== */

app.get("/api/control-center", async (req, res) => {

  try {

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const aircraftRankings = aircraft.map((a) => {

      const related = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const riskScore =
        totalHours * 0.04 + Math.random() * 10;

      return {
        aircraft: a,
        metrics: {
          totalHours,
          riskScore
        }
      };

    });

    res.json({
      status: "success",
      aircraftRankings
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

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const enriched = aircraft.map((a) => {

      const related = flights.filter(
        (f) => f.aircraft_id === a.id
      );

      const totalHours = related.reduce(
        (sum, f) => sum + Number(f.flight_hours || 0),
        0
      );

      const failure =
        Math.min(100, totalHours * 0.05 + Math.random() * 20);

      return {
        id: a.id,
        tail: a.tail_number,
        failure
      };

    });

    const actions = generateActions(enriched);

    res.json({
      status: "success",
      totalActions: actions.length,
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
   🧠 CHAT OPS AI ENDPOINT (NEW)
=============================== */

app.post("/api/ai/chat", async (req, res) => {

  try {

    const { sessionId = "default", message } = req.body;

    /* ===============================
       INIT SESSION MEMORY
    =============================== */

    if (!sessions[sessionId]) {
      sessions[sessionId] = [];
    }

    const history = sessions[sessionId];

    /* ===============================
       FETCH FLEET DATA
    =============================== */

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("*");

    const { data: flights } = await supabase
      .from("flights")
      .select("*");

    const fleet = aircraft.map((a) => {

      const related = flights.filter(
        (f) => f.aircraft_id === a.id
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

    const actions = generateActions(fleet);

    /* ===============================
       AI RESPONSE (CORE)
    =============================== */

    const aiResponse = interpretCommand(
      message,
      fleet,
      actions
    );

    /* ===============================
       SAVE MEMORY
    =============================== */

    history.push({
      role: "user",
      message
    });

    history.push({
      role: "assistant",
      response: aiResponse.summary
    });

    sessions[sessionId] = history.slice(-10); // keep last 10

    /* ===============================
       RESPONSE
    =============================== */

    res.json({
      status: "success",
      sessionId,
      memory: sessions[sessionId],
      ai: aiResponse
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
  console.log(`Operion Chat Ops running on port ${PORT}`);
});

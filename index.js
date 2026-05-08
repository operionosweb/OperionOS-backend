import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import http from "http";
import { Server } from "socket.io";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";
import { generateDailyOpsReport } from "./ops/autonomousEngine.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HTTP + WEBSOCKET SERVER
=============================== */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/* ===============================
   SUPABASE
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   WEBSOCKET CONNECTION
=============================== */

io.on("connection", (socket) => {

  console.log("🔵 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });

});

/* ===============================
   BROADCAST HELPER
=============================== */

function broadcast(event, data) {
  io.emit(event, data);
}

/* ===============================
   FLEET BUILDER
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

  const fleet = await buildFleet();

  res.json({
    status: "success",
    fleet
  });

});

/* ===============================
   AI COMMAND
=============================== */

app.post("/api/ai/command", async (req, res) => {

  const { command } = req.body;

  const fleet = await buildFleet();

  const actions = generateActions(fleet);

  const result = interpretCommand(command, fleet, actions);

  res.json({
    status: "success",
    ai: result
  });

});

/* ===============================
   OPS REPORT
=============================== */

app.get("/api/ops/daily-report", async (req, res) => {

  const fleet = await buildFleet();

  const actions = generateActions(fleet);

  const report = generateDailyOpsReport(fleet, actions);

  res.json({
    status: "success",
    report
  });

});

/* ===============================
   🧠 LIVE OPS ENGINE (NEW CORE)
=============================== */

async function liveOpsLoop() {

  const fleet = await buildFleet();

  const actions = generateActions(fleet);

  const report = generateDailyOpsReport(fleet, actions);

  /* ===============================
     DETECT CRITICAL EVENTS
  =============================== */

  const critical = report.riskGroups.critical.length;
  const high = report.riskGroups.high.length;

  const event = {
    timestamp: new Date().toISOString(),
    mode:
      critical > 0
        ? "EMERGENCY"
        : high > 3
        ? "ELEVATED"
        : "NORMAL",
    metrics: report.metrics,
    criticalCount: critical,
    highCount: high
  };

  /* ===============================
     BROADCAST REAL-TIME UPDATE
  =============================== */

  broadcast("ops_update", event);

  if (critical > 0) {
    broadcast("alert", {
      level: "CRITICAL",
      message: "Critical aircraft detected — immediate action required"
    });
  }

  if (high > 3) {
    broadcast("alert", {
      level: "WARNING",
      message: "Fleet risk elevated"
    });
  }

}

/* ===============================
   START LIVE LOOP
=============================== */

setInterval(liveOpsLoop, 10000); // every 10 seconds

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Operion Live Ops running on port ${PORT}`);
});

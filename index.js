import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import http from "http";
import { Server } from "socket.io";

import { generateActions } from "./actionEngine.js";
import { interpretCommand } from "./ai/commandEngine.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/* ===============================
   CORE SERVICES
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ===============================
   AUTH
=============================== */

async function auth(req, res, next) {

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.user = data.user;
  next();
}

/* ===============================
   REAL-TIME FLEET ENGINE
=============================== */

let fleetCache = [];

/**
 * Simulates live aircraft telemetry updates
 * (later replaced with real IoT / flight data feed)
 */
function updateFleet() {

  fleetCache = fleetCache.map((a) => {

    const drift = (Math.random() - 0.5) * 5;

    let failure = (a.failure || 20) + drift;

    if (failure < 0) failure = 0;
    if (failure > 100) failure = 100;

    return {
      ...a,
      failure
    };

  });

  io.emit("fleet:update", fleetCache);
}

/* ===============================
   INIT DEMO FLEET
=============================== */

function initFleet() {

  fleetCache = [
    { id: "1", tail: "OE-LA1", model: "A320", failure: 20 },
    { id: "2", tail: "OE-LA2", model: "A320", failure: 35 },
    { id: "3", tail: "OE-LB1", model: "B737", failure: 55 }
  ];

}

/* ===============================
   SOCKET CONNECTION
=============================== */

io.on("connection", (socket) => {

  console.log("🔵 client connected");

  socket.emit("fleet:init", fleetCache);

});

/* ===============================
   CONTROL CENTER API (STATIC SNAPSHOT)
=============================== */

app.get("/api/control-center", auth, async (req, res) => {

  res.json({
    fleet: fleetCache
  });

});

/* ===============================
   AI COMMAND ENGINE
=============================== */

app.post("/api/ai/command", auth, async (req, res) => {

  const { command } = req.body;

  const actions = generateActions(fleetCache);

  const result = interpretCommand(command, fleetCache, actions);

  res.json({
    ai: result
  });

});

/* ===============================
   START REAL-TIME LOOP
=============================== */

initFleet();

setInterval(() => {
  updateFleet();
}, 3000); // every 3 seconds

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log("🚀 Operion Real-Time Engine Running");
});

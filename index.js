const express = require("express");
const cors = require("cors");

const app = express();

// ========================
// SAFE MIDDLEWARE
// ========================
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Force clean HTTP behavior (important for HTTP Shortcuts)
app.use((req, res, next) => {
  res.setHeader("Connection", "close");
  next();
});

// ========================
// HEALTH CHECK
// ========================
app.get("/", (req, res) => {
  return res.status(200).json({
    status: "Operion AI Backend Running",
    memory: "active",
    auth: "ready"
  });
});

// ========================
// CHAT ENDPOINT (PROTOCOL SAFE)
// ========================
app.post("/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (!message) {
      return res.status(400).json({
        error: "missing_message"
      });
    }

    // SAFE STATIC RESPONSE (no async streaming risk)
    const reply = `You said: ${message}`;

    return res.status(200).json({
      reply: reply
    });

  } catch (err) {
    console.error("CHAT ERROR:", err);

    return res.status(500).json({
      error: "server_error"
    });
  }
});

// ========================
// DEBUG ENDPOINT
// ========================
app.post("/debug", (req, res) => {
  return res.status(200).json({
    ok: true,
    received: req.body || null
  });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 10000;

const server = app.listen(PORT, () => {
  console.log("Operion backend running on port", PORT);
});

// CRITICAL: force close idle sockets (fixes PROTOCOL_ERROR on Render)
server.keepAliveTimeout = 0;
server.headersTimeout = 0;

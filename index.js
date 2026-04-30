const express = require("express");
const cors = require("cors");

// Load environment variables (Render injects these automatically)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===============================
// HEALTH CHECK (IMPORTANT)
// ===============================
app.get("/", (req, res) => {
  return res.json({
    status: "Operion AI Backend Running",
    memory: "active",
    auth: "ready"
  });
});

// ===============================
// CHAT ENDPOINT (SAFE MODE)
// ===============================
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "missing_message"
      });
    }

    // TEMP AI RESPONSE (replace later with Mistral call)
    const reply = `You said: ${message}`;

    return res.status(200).json({
      reply,
      memory: {
        last_message: message
      }
    });

  } catch (err) {
    console.error("CHAT ERROR:", err);

    return res.status(500).json({
      error: "server_error"
    });
  }
});

// ===============================
// AUTH TEST ENDPOINT (JWT CHECK)
// ===============================
app.post("/auth-test", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "missing_authorization_header"
    });
  }

  return res.json({
    status: "authorized",
    received: authHeader
  });
});

// ===============================
// DEBUG ENDPOINT (OPTIONAL)
// ===============================
app.post("/debug", (req, res) => {
  console.log("DEBUG HIT");
  console.log(req.body);

  return res.json({
    ok: true,
    body: req.body
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Operion backend running on port", PORT);

  console.log("SUPABASE_URL:", SUPABASE_URL ? "OK" : "MISSING");
  console.log("SUPABASE_KEY:", SUPABASE_KEY ? "OK" : "MISSING");
  console.log("MISTRAL_API_KEY:", MISTRAL_API_KEY ? "OK" : "MISSING");
});

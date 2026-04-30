// index.js

const express = require("express");
const app = express();

// Middleware
app.use(express.json());

/* --------------------------------
   1. HEALTH CHECK (NO LOGIC)
-------------------------------- */
app.get("/", (req, res) => {
  res.send("Operion Backend is Running 🚀");
});

/* --------------------------------
   2. TEST ENDPOINT (CONNECTIVITY)
-------------------------------- */
app.post("/test", (req, res) => {
  res.json({
    ok: true,
    message: "API is working",
    received: req.body || null
  });
});

/* --------------------------------
   3. MESSAGE ENDPOINT (CORE LOGIC)
-------------------------------- */
app.post("/message", (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }

  res.json({
    reply: `Operion received: ${message}`
  });
});

/* --------------------------------
   4. AUTH PLACEHOLDER (FOR FUTURE)
-------------------------------- */
app.post("/auth", (req, res) => {
  res.json({
    ok: true,
    message: "Auth system not enabled yet"
  });
});

/* --------------------------------
   START SERVER
-------------------------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

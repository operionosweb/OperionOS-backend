// index.js

const express = require("express");
const app = express();

// Middleware
app.use(express.json());

// Root route (browser test)
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

// ✅ TEST ENDPOINT (connectivity check)
app.post("/test3", (req, res) => {
  res.json({
    ok: true,
    message: "test3 endpoint works ✅",
    received: req.body
  });
});

// ✅ REAL MESSAGE ENDPOINT
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

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

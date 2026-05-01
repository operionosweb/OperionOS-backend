// index.js

const express = require("express");
const axios = require("axios");

const app = express();

// Middleware
app.use(express.json());

/* --------------------------------
   1. HEALTH CHECK
-------------------------------- */
app.get("/", (req, res) => {
  res.send("Operion Backend with Mistral AI 🚀");
});

/* --------------------------------
   2. TEST ENDPOINT
-------------------------------- */
app.post("/test", (req, res) => {
  res.json({
    ok: true,
    message: "API is working",
    received: req.body || null
  });
});

/* --------------------------------
   3. AI MESSAGE ENDPOINT
-------------------------------- */
app.post("/message", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }

  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: "You are Operion, a smart AI assistant."
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    res.json({
      reply: aiReply
    });

  } catch (error) {
    console.error("Mistral error:", error.response?.data || error.message);

    res.status(500).json({
      error: "AI request failed"
    });
  }
});

/* --------------------------------
   4. AUTH PLACEHOLDER
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

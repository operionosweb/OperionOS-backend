const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.use(express.json());

/**
 * SIMPLE IN-MEMORY STORAGE (temporary memory)
 * Structure:
 * {
 *   "user1": [
 *     { role: "user", content: "Hi" },
 *     { role: "assistant", content: "Hello!" }
 *   ]
 * }
 */
const memory = {};

// Health check
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running (with memory)");
});

// CHAT WITH MEMORY
app.post("/chat", async (req, res) => {
  const userId = req.body.userId || "default";
  const message = req.body.message;

  if (!message) {
    return res.json({ reply: "No message received" });
  }

  // Create memory bucket if not exists
  if (!memory[userId]) {
    memory[userId] = [];
  }

  // Add user message to memory
  memory[userId].push({
    role: "user",
    content: message
  });

  // Limit memory (keep last 10 messages only)
  if (memory[userId].length > 10) {
    memory[userId].shift();
  }

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: memory[userId]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No AI response received";

    // Save assistant reply to memory
    memory[userId].push({
      role: "assistant",
      content: reply
    });

    res.json({
      reply,
      memory: memory[userId] // optional debug (you can remove later)
    });

  } catch (error) {
    res.json({
      reply: "Error: " + error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion backend running with memory on port " + PORT);
});

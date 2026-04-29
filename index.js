const express = require("express");
const fetch = require("node-fetch");

const app = express();

app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Operion AI Backend Running");
});

// Chat endpoint (Mistral AI)
app.post("/chat", async (req, res) => {
  const message = req.body.message;

  if (!message) {
    return res.json({ reply: "No message received" });
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
        messages: [
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No response from AI";

    res.json({ reply });

  } catch (error) {
    res.json({
      reply: "AI error: " + error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion backend running on port " + PORT);
});

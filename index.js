const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* -----------------------------
   HEALTH CHECK
------------------------------ */
app.get("/", (req, res) => {
  res.send("Operion AI with Memory 🚀");
});

/* -----------------------------
   TEST ENDPOINT
------------------------------ */
app.post("/test", (req, res) => {
  res.json({
    ok: true,
    message: "API is working",
    received: req.body || null
  });
});

/* -----------------------------
   MESSAGE WITH MEMORY (10 msgs)
------------------------------ */
app.post("/message", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }

  try {
    // 1. Save user message
    await supabase.from("messages").insert([
      { role: "user", content: message }
    ]);

    // 2. Get last 10 messages (memory)
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    // 3. Format history for Mistral
    const formattedHistory = (history || [])
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content
      }));

    // 4. Call Mistral AI
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: "You are Operion, a helpful AI assistant with memory of past conversations."
          },
          ...formattedHistory
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // 5. Save AI response
    await supabase.from("messages").insert([
      { role: "assistant", content: aiReply }
    ]);

    // 6. Return response
    res.json({
      reply: aiReply
    });

  } catch (error) {
    console.error("Error:", error.response?.data || error.message);

    res.status(500).json({
      error: "AI processing failed"
    });
  }
});

/* -----------------------------
   AUTH PLACEHOLDER
------------------------------ */
app.post("/auth", (req, res) => {
  res.json({
    ok: true,
    message: "Auth not enabled yet"
  });
});

/* -----------------------------
   START SERVER
------------------------------ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

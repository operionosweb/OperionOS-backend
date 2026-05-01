const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* --------------------------------
   OPERION CORE IDENTITY LAYER
-------------------------------- */
const OPERION_SYSTEM_PROMPT = `
You are Operion.

Operion is not a generic chatbot. It is an operational intelligence system designed for engineering, aviation, maritime, and industrial domains.

Behavior rules:
- Be concise and structured
- Focus on technical accuracy
- Prefer systems thinking over generic advice
- If user mentions aviation, maritime, offshore, or engineering topics, go deeper into technical detail
- Avoid unnecessary conversational fluff
- Provide actionable insights when possible
`;

/* --------------------------------
   HEALTH CHECK
-------------------------------- */
app.get("/", (req, res) => {
  res.send("Operion Intelligence Layer Active 🚀");
});

/* --------------------------------
   MESSAGE WITH PERSONA + MEMORY
-------------------------------- */
app.post("/message", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // 1. Get last 10 messages
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    const formattedHistory = (history || [])
      .reverse()
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    // 2. Build AI context
    const messagesForAI = [
      {
        role: "system",
        content: OPERION_SYSTEM_PROMPT
      },
      ...formattedHistory,
      {
        role: "user",
        content: message
      }
    ];

    // 3. Call Mistral
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: messagesForAI,
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // 4. Save memory
    await supabase.from("messages").insert([
      { role: "user", content: message }
    ]);

    await supabase.from("messages").insert([
      { role: "assistant", content: aiReply }
    ]);

    // 5. Return response
    res.json({
      reply: aiReply
    });

  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Operion processing failed"
    });
  }
});

/* --------------------------------
   START SERVER
-------------------------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion running with personality layer 🚀");
});

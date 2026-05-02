import express from "express";
import { createClient } from "@supabase/supabase-js";

// -------------------------
// ENV SAFETY (NO CRASH)
// -------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables");
}

if (!MISTRAL_API_KEY) {
  console.error("❌ Missing Mistral API key");
}

// -------------------------
// INIT CLIENTS
// -------------------------
const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

// -------------------------
// APP SETUP
// -------------------------
const app = express();
app.use(express.json());

// -------------------------
// HEALTH CHECK
// -------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Operion Backend Running",
    memory: "active",
  });
});

// -------------------------
// MISTRAL CALL (NO SDK, PURE FETCH)
// -------------------------
async function callMistral(prompt) {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are Operion Intelligence Core." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "No response";
  } catch (err) {
    console.error("Mistral Error:", err);
    return "AI error";
  }
}

// -------------------------
// MAIN ROUTE
// -------------------------
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body?.message;

    if (!userMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    // 1. Get AI response
    const aiReply = await callMistral(userMessage);

    // 2. OPTIONAL: store memory (safe fail)
    try {
      await supabase.from("user_memory").insert([
        {
          content: userMessage,
          domain: "chat",
        },
      ]);
    } catch (dbErr) {
      console.error("Memory store error:", dbErr.message);
    }

    // 3. Respond
    res.json({
      reply: aiReply,
      domain: "operion-core",
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// -------------------------
// START SERVER
// -------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Operion backend running on port ${PORT}`);
});

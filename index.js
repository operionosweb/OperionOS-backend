const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Debug logs (safe to keep)
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "OK" : "MISSING");
console.log("MISTRAL_API_KEY:", process.env.MISTRAL_API_KEY ? "OK" : "MISSING");

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Health check
app.get("/", (req, res) => {
  res.send("Operion Memory v1 Running");
});

// CHAT ENDPOINT (STABLE VERSION)
app.post("/chat", async (req, res) => {
  const userId = req.body.userId || "default";
  const message = req.body.message;

  if (!message) {
    return res.json({ reply: "No message received" });
  }

  try {
    // 1. Save user message
    await supabase.from("messages").insert([
      {
        user_id: userId,
        role: "user",
        content: message
      }
    ]);

    // 2. Get last 5 messages
    const { data: history, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.json({ reply: "Database error" });
    }

    const messages = history.reverse();

    // 3. Call Mistral
    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-small",
          messages: messages
        })
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No AI response";

    // 4. Save assistant reply
    await supabase.from("messages").insert([
      {
        user_id: userId,
        role: "assistant",
        content: reply
      }
    ]);

    // 5. Return response
    res.json({ reply });

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.json({
      reply: "Error: " + error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

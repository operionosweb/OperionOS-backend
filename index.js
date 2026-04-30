const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// ============================
// ENV CHECK (DEBUG SAFE)
// ============================
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase environment variables");
}

if (!process.env.MISTRAL_API_KEY) {
  console.error("❌ Missing Mistral API key");
}

// ============================
// SUPABASE CLIENT (FIXED)
// ============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================
// HEALTH CHECK
// ============================
app.get("/", (req, res) => {
  res.send("Operion JWT Backend Running");
});

// ============================
// AUTH HELPER (JWT)
// ============================
async function getUser(req) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) return null;

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error("Auth error:", error.message);
      return null;
    }

    return data.user;
  } catch (err) {
    console.error("JWT error:", err.message);
    return null;
  }
}

// ============================
// CHAT ENDPOINT (FULL FIXED)
// ============================
app.post("/chat", async (req, res) => {
  const user = await getUser(req);
  const message = req.body.message;

  if (!user) {
    return res.json({ reply: "Unauthorized (invalid or missing token)" });
  }

  if (!message) {
    return res.json({ reply: "No message provided" });
  }

  try {
    // Save user message
    await supabase.from("messages").insert([
      {
        user_id: user.id,
        role: "user",
        content: message
      }
    ]);

    // Get memory
    const { data: history, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("DB error:", error.message);
      return res.json({ reply: "Database error" });
    }

    const messages = history.reverse();

    // Call Mistral AI
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
          messages
        })
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No AI response";

    // Save assistant reply
    await supabase.from("messages").insert([
      {
        user_id: user.id,
        role: "assistant",
        content: reply
      }
    ]);

    // Return response
    res.json({ reply });

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.json({ reply: "Error: " + error.message });
  }
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion JWT Auth System Running on port " + PORT);
});

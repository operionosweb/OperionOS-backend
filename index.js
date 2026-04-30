const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// IMPORTANT: service role key for backend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔐 EXTRACT USER FROM JWT
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
    console.error("JWT parsing error:", err.message);
    return null;
  }
}

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Operion JWT Auth System Running");
});

// CHAT (JWT SECURED)
app.post("/chat", async (req, res) => {
  const user = await getUser(req);
  const message = req.body.message;

  if (!user) {
    return res.json({ reply: "Unauthorized (invalid token)" });
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

    // Get history
    const { data: history, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      return res.json({ reply: "DB error" });
    }

    const messages = history.reverse();

    // Call Mistral
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

    res.json({ reply });

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.json({ reply: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion JWT Auth Ready");
});

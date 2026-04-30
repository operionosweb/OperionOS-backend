const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Operion Smart Memory v2 Running");
});

// 🧠 EXTRACT PROFILE FROM CONVERSATION
async function extractProfile(messages) {
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
        messages: [
          {
            role: "system",
            content:
              "Extract and update a structured user profile from this conversation. Output ONLY key facts (name, interests, goals, preferences)."
          },
          {
            role: "user",
            content: JSON.stringify(messages)
          }
        ]
      })
    }
  );

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
}

// 🧠 CHAT ENDPOINT (SMART MEMORY v2)
app.post("/chat", async (req, res) => {
  const userId = req.body.userId || "default";
  const message = req.body.message;

  if (!message) {
    return res.json({ reply: "No message received" });
  }

  try {
    // 1. Save user message
    await supabase.from("messages").insert([
      { user_id: userId, role: "user", content: message }
    ]);

    // 2. Get last messages (short-term memory)
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const recent = history.reverse();

    // 3. Get stored profile (LONG-TERM MEMORY)
    const { data: profileRow } = await supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .single();

    const profile = profileRow?.profile || "";

    // 4. Build AI context
    const messagesForAI = [
      {
        role: "system",
        content: "You are Operion AI, a personalized assistant."
      }
    ];

    if (profile) {
      messagesForAI.push({
        role: "system",
        content: "User profile:\n" + profile
      });
    }

    messagesForAI.push(...recent);

    // 5. Call Mistral
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
          messages: messagesForAI
        })
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No AI response";

    // 6. Save assistant reply
    await supabase.from("messages").insert([
      { user_id: userId, role: "assistant", content: reply }
    ]);

    // 7. Occasionally update profile (IMPORTANT PART)
    if (Math.random() < 0.3) {
      const newProfile = await extractProfile(recent);

      await supabase.from("user_profile").upsert([
        {
          user_id: userId,
          profile: newProfile,
          updated_at: new Date()
        }
      ]);
    }

    res.json({ reply });

  } catch (error) {
    console.error("SMART MEMORY v2 ERROR:", error);
    res.json({ reply: "Error: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion Smart Memory v2 running");
});

const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Helper: summarize memory
async function summarizeMemory(messages) {
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
              "Summarize the following conversation into key facts about the user (short, bullet-style)."
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

app.get("/", (req, res) => {
  res.send("Operion Smart Memory Active");
});

app.post("/chat", async (req, res) => {
  const userId = req.body.userId || "default";
  const message = req.body.message;

  if (!message) {
    return res.json({ reply: "No message received" });
  }

  try {
    // Save user message
    await supabase.from("messages").insert([
      { user_id: userId, role: "user", content: message }
    ]);

    // Get last 6 messages
    const { data: recent } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    // Reverse order (oldest first)
    const recentMessages = recent.reverse();

    // Get ALL messages for summary (light version)
    const { data: allMessages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId);

    // Create summary every ~10 messages
    let summary = "";
    if (allMessages.length % 10 === 0) {
      summary = await summarizeMemory(allMessages);
    }

    // Build final prompt
    const messagesForAI = [
      {
        role: "system",
        content:
          "You are Operion AI. Use the memory summary and recent messages to respond intelligently."
      }
    ];

    if (summary) {
      messagesForAI.push({
        role: "system",
        content: "User memory: " + summary
      });
    }

    messagesForAI.push(...recentMessages);

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
          messages: messagesForAI
        })
      }
    );

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No AI response";

    // Save assistant reply
    await supabase.from("messages").insert([
      { user_id: userId, role: "assistant", content: reply }
    ]);

    res.json({ reply });

  } catch (error) {
    res.json({ reply: "Error: " + error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion running with SMART memory");
});

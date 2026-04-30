const express = require("express");
const fetch = require("node-fetch");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Supabase client
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
              "Summarize key facts about the user from this conversation."
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

// Health check
app.get("/", (req, res) => {
  res.send("Operion TRUE Memory Active");
});

// CHAT ENDPOINT
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

    // 2. Get recent messages
    const { data: recent } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const recentMessages = recent.reverse();

    // 3. Get stored summary
    const { data: memoryRow } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", userId)
      .single();

    const summary = memoryRow?.summary || "";

    // 4. Build AI input
    const messagesForAI = [
      {
        role: "system",
        content: "You are Operion AI."
      }
    ];

    if (summary) {
      messagesForAI.push({
        role: "system",
        content: "User memory: " + summary
      });
    }

    messagesForAI.push(...recentMessages);

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

    // 6

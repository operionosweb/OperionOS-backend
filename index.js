const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* -----------------------------
   HEALTH
------------------------------ */
app.get("/", (req, res) => {
  res.send("Operion AI with Smart Memory 🚀");
});

/* -----------------------------
   MESSAGE (SMART MEMORY)
------------------------------ */
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

    // 2. Build system context WITH summary if exists
    const summary = history?.[0]?.memory_summary || "";

    const messagesForAI = [
      {
        role: "system",
        content:
          "You are Operion, an intelligent assistant with long-term memory."
      },
      ...(summary
        ? [
            {
              role: "system",
              content: `Memory summary: ${summary}`
            }
          ]
        : []),
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
        messages: messagesForAI
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // 4. Save messages
    await supabase.from("messages").insert([
      { role: "user", content: message }
    ]);

    await supabase.from("messages").insert([
      { role: "assistant", content: aiReply }
    ]);

    // 5. OPTIONAL: create/update memory summary
    if (history && history.length >= 10) {
      const oldText = formattedHistory.map(m => `${m.role}: ${m.content}`).join("\n");

      const summaryResponse = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-small",
          messages: [
            {
              role: "system",
              content:
                "Summarize the following conversation into a short memory (max 5 lines)."
            },
            {
              role: "user",
              content: oldText
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      const newSummary =
        summaryResponse.data.choices[0].message.content;

      // store summary in latest row
      await supabase
        .from("messages")
        .update({ memory_summary: newSummary })
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    res.json({
      reply: aiReply
    });
  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Smart memory failed"
    });
  }
});

/* -----------------------------
   START
------------------------------ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

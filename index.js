import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// ENV
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !MISTRAL_API_KEY) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// TEST
app.get("/", (req, res) => {
  res.send("Operion Backend Running ✅");
});

// 🔥 KEY FUNCTION: FILTER MEMORY (BIG IMPACT)
function getRelevantMemory(memory, message) {
  if (!memory) return [];

  const keywords = message.toLowerCase().split(" ");

  return memory
    .filter(item =>
      keywords.some(word =>
        item.message?.toLowerCase().includes(word)
      )
    )
    .slice(0, 3); // LIMIT = HUGE SPEED BOOST
}

// MAIN
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon", domain = "general" } = req.body;

    // 🔹 GET MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("message, reply")
      .eq("user_id", user_id)
      .limit(10);

    // 🔥 FILTER ONLY RELEVANT MEMORY
    const relevantMemory = getRelevantMemory(memory, message);

    // 🔥 COMPRESS MEMORY (TOKEN REDUCTION)
    const memoryText = relevantMemory
      .map(m => `User: ${m.message} | AI: ${m.reply}`)
      .join("\n");

    // 🔹 CALL AI
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `You are an expert in ${domain}.
Use memory ONLY if relevant.

Memory:
${memoryText}`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 300 // 🔥 LIMIT RESPONSE SIZE = SPEED
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No response";

    // 🔹 SAVE (messages)
    await supabase.from("messages").insert([
      { user_id, message, reply, domain }
    ]);

    // 🔥 SAVE ONLY IMPORTANT MEMORY
    if (message.length < 200) {
      await supabase.from("user_memory").insert([
        { user_id, message, reply }
      ]);
    }

    res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

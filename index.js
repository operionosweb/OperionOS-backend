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
  res.send("Operion Brain Running 🧠");
});

// 🔥 MEMORY FILTER
function getRelevantMemory(memory, message) {
  if (!memory) return [];

  const keywords = message.toLowerCase().split(" ");

  return memory
    .filter(item =>
      keywords.some(word =>
        item.message?.toLowerCase().includes(word)
      )
    )
    .slice(0, 3);
}

// 🔥 PROFILE EXTRACTOR (AUTO-LEARNING)
function extractProfileData(message) {
  const text = message.toLowerCase();

  let domain = null;

  if (text.includes("aircraft") || text.includes("aviation")) domain = "aviation";
  if (text.includes("ship") || text.includes("marine")) domain = "maritime";
  if (text.includes("drilling") || text.includes("offshore")) domain = "offshore";

  return {
    last_topic: message.slice(0, 100),
    detected_domain: domain
  };
}

// MAIN
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // 🔹 LOAD PROFILE
    const { data: profileData } = await supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", user_id)
      .single();

    const profile = profileData || {};

    // 🔹 LOAD MEMORY
    const { data: memory } = await supabase
      .from("user_memory")
      .select("message, reply")
      .eq("user_id", user_id)
      .limit(10);

    const relevantMemory = getRelevantMemory(memory, message);

    const memoryText = relevantMemory
      .map(m => `User: ${m.message} | AI: ${m.reply}`)
      .join("\n");

    // 🔥 PROFILE LEARNING
    const extracted = extractProfileData(message);

    const domain = extracted.detected_domain || profile.preferred_domain || "general";

    // 🔹 AI CALL
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
            content: `
You are Operion AI.

User profile:
- Preferred domain: ${profile.preferred_domain || "unknown"}
- Last topic: ${profile.last_topic || "none"}

Act like an expert in ${domain}.
Be concise, high-value, structured.

Memory:
${memoryText}
`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 250
      })
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No response";

    // 🔹 SAVE MESSAGE
    await supabase.from("messages").insert([
      { user_id, message, reply, domain }
    ]);

    // 🔹 SAVE MEMORY
    if (message.length < 200) {
      await supabase.from("user_memory").insert([
        { user_id, message, reply }
      ]);
    }

    // 🔥 UPDATE PROFILE (UPSERT)
    await supabase.from("user_profile").upsert([
      {
        user_id,
        preferred_domain: domain,
        last_topic: extracted.last_topic
      }
    ]);

    res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// START
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion Brain running on port", PORT);
});

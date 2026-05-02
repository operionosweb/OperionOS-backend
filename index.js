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
  res.send("Operion Intelligence Core 🧠⚡");
});

// 🔥 IMPORTANCE SCORING
function scoreMemory(item) {
  let score = 0;

  if (!item.message) return 0;

  const lengthScore = Math.min(item.message.length / 50, 2); // longer = more value
  const hasNumbers = /\d/.test(item.message) ? 1 : 0;
  const hasKeywords =
    /(strategy|important|critical|problem|solution|roi|failure)/i.test(item.message)
      ? 2
      : 0;

  score = lengthScore + hasNumbers + hasKeywords;

  return score;
}

// 🔥 SELECT BEST MEMORY (NOT JUST MATCHING)
function selectTopMemory(memory) {
  if (!memory) return [];

  return memory
    .map(m => ({ ...m, score: scoreMemory(m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// 🔥 DOMAIN DETECTION (UPGRADED)
function detectDomain(message) {
  const text = message.toLowerCase();

  if (text.includes("aircraft") || text.includes("aviation")) return "aviation";
  if (text.includes("ship") || text.includes("marine")) return "maritime";
  if (text.includes("drilling") || text.includes("offshore")) return "offshore";

  return "general";
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
      .select("*")
      .eq("user_id", user_id)
      .limit(20);

    // 🔥 SELECT MOST IMPORTANT MEMORY
    const topMemory = selectTopMemory(memory);

    const memoryText = topMemory
      .map(m => `(${m.score.toFixed(1)}) ${m.message}`)
      .join("\n");

    // 🔥 DOMAIN
    const detectedDomain = detectDomain(message);
    const domain = detectedDomain !== "general"
      ? detectedDomain
      : profile.preferred_domain || "general";

    // 🔥 THINKING STEP (VERY IMPORTANT)
    const thinkingPrompt = `
Analyze the user request and decide:
1. What is the real intent?
2. What matters most from memory?
3. What is the best structured answer?

User message:
${message}

Memory:
${memoryText}
`;

    const thinkingResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [{ role: "user", content: thinkingPrompt }],
        max_tokens: 150
      })
    });

    const thinkingData = await thinkingResponse.json();
    const thinking = thinkingData?.choices?.[0]?.message?.content || "";

    // 🔥 FINAL ANSWER (BASED ON THINKING)
    const finalResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
You are Operion Intelligence Core.

Domain: ${domain}

Use this reasoning:
${thinking}

Respond with:
- clarity
- structure
- high-value insight
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

    const finalData = await finalResponse.json();
    const reply = finalData?.choices?.[0]?.message?.content || "No response";

    // 🔹 SAVE MESSAGE
    await supabase.from("messages").insert([
      { user_id, message, reply, domain }
    ]);

    // 🔥 SAVE ONLY HIGH-VALUE MEMORY
    if (scoreMemory({ message }) > 1.5) {
      await supabase.from("user_memory").insert([
        { user_id, message, reply }
      ]);
    }

    // 🔹 UPDATE PROFILE
    await supabase.from("user_profile").upsert([
      {
        user_id,
        preferred_domain: domain,
        last_topic: message.slice(0, 100)
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
  console.log("Operion Core running on port", PORT);
});

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ENV
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// CLIENT
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SIMPLE SCORING
function scoreMemory(text) {
  const lengthScore = Math.min(text.length / 200, 1);
  const keywordScore = /important|critical|strategy|risk/i.test(text) ? 1 : 0.5;
  return (lengthScore + keywordScore) / 2;
}

// ROUTE
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "default-user" } = req.body;

    // 1. GET MEMORY
    const { data: memories } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .order("score", { ascending: false })
      .limit(5);

    const memoryContext = memories?.map(m => m.summary).join("\n") || "";

    // 2. CALL MISTRAL
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-small",
        messages: [
          { role: "system", content: "You are Operion Intelligence Core." },
          { role: "system", content: `Memory:\n${memoryContext}` },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    // 3. STORE MEMORY
    const score = scoreMemory(message);

    await supabase.from("user_memory").insert({
      user_id,
      summary: message,
      score: score,
      importance: score
    });

    // 4. CONSOLIDATE MEMORY (🔥 KEY STEP)
    await supabase.rpc("consolidate_memory", {
      p_user_id: user_id
    });

    res.json({ reply });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Operion running on port ${PORT}`);
});

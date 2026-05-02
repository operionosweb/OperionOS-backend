import express from "express";
import { createClient } from "@supabase/supabase-js";

// -------------------------
// ENV SAFETY
// -------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables");
}

if (!MISTRAL_API_KEY) {
  console.error("❌ Missing Mistral API key");
}

// -------------------------
// CLIENTS
// -------------------------
const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

// -------------------------
// APP
// -------------------------
const app = express();
app.use(express.json());

// -------------------------
// HEALTH
// -------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Operion Intelligence Core",
    memory: "user-based vector enabled"
  });
});

// -------------------------
// MISTRAL CHAT
// -------------------------
async function callMistral(prompt) {
  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are Operion Intelligence Core with personal memory." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "No response";
  } catch (err) {
    console.error("Mistral error:", err);
    return "AI error";
  }
}

// -------------------------
// EMBEDDINGS
// -------------------------
async function getEmbedding(text) {
  try {
    const res = await fetch("https://api.mistral.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-embed",
        input: text
      })
    });

    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (err) {
    console.error("Embedding error:", err);
    return null;
  }
}

// -------------------------
// USER MEMORY SEARCH
// -------------------------
async function searchMemory(userId, embedding) {
  try {
    const { data, error } = await supabase.rpc("match_user_memory", {
      query_embedding: embedding,
      match_threshold: 0.75,
      match_count: 5
    });

    if (error) {
      console.error("Memory search error:", error);
      return [];
    }

    // filter by user_id (important)
    return (data || []).filter(m => m.user_id === userId);
  } catch (err) {
    console.error("Search error:", err);
    return [];
  }
}

// -------------------------
// MAIN ROUTE (USER MEMORY CORE)
// -------------------------
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body?.message;
    const userId = req.body?.user_id || "anonymous";

    if (!userMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    // 1. embedding
    const embedding = await getEmbedding(userMessage);

    // 2. memory search (user-specific)
    let memories = [];
    if (embedding) {
      memories = await searchMemory(userId, embedding);
    }

    const memoryContext = memories.map(m => m.content).join("\n");

    // 3. prompt
    const prompt = `
You are Operion Intelligence Core.

User ID: ${userId}

Memory:
${memoryContext}

User:
${userMessage}
`;

    // 4. AI response
    const aiReply = await callMistral(prompt);

    // 5. store memory (with user_id)
    try {
      await supabase.from("user_memory").insert([
        {
          user_id: userId,
          content: userMessage,
          embedding: embedding,
          domain: "chat"
        }
      ]);
    } catch (e) {
      console.error("Insert error:", e.message);
    }

    // 6. response
    res.json({
      reply: aiReply,
      user_id: userId,
      memory_hits: memories.length
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// -------------------------
// START
// -------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Operion Personal Intelligence running on port ${PORT}`);
});

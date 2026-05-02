import express from "express";
import { createClient } from "@supabase/supabase-js";

// -------------------------
// ENV
// -------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

const app = express();
app.use(express.json());

// -------------------------
// HEALTH
// -------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Operion Intelligence Core",
    memory: "quality-scored + ranked"
  });
});

// -------------------------
// MISTRAL CALL
// -------------------------
async function callMistral(messages) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages,
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// -------------------------
// EMBEDDING
// -------------------------
async function getEmbedding(text) {
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
}

// -------------------------
// MEMORY SEARCH (RANKED)
// -------------------------
async function searchMemory(userId, embedding) {
  const { data } = await supabase.rpc("match_user_memory", {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: 5,
    p_user_id: userId
  });

  return data || [];
}

// -------------------------
// 🧠 MEMORY QUALITY EVALUATION
// -------------------------
async function evaluateMemory(message) {
  const prompt = `
Analyze this user message.

Return ONLY JSON:

{
  "summary": "short compressed memory",
  "importance": number between 0 and 1,
  "store": true or false
}

Rules:
- Ignore small talk
- Ignore greetings
- Store only useful knowledge, intent, or preferences
- Importance:
  0.9 = critical info
  0.7 = useful info
  0.5 = neutral
  0.2 = low value
  0 = ignore

Message:
${message}
`;

  const result = await callMistral([
    { role: "user", content: prompt }
  ]);

  try {
    return JSON.parse(result);
  } catch {
    return { store: false };
  }
}

// -------------------------
// MAIN ROUTE
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

    // 2. memory recall
    let memories = [];
    if (embedding) {
      memories = await searchMemory(userId, embedding);
    }

    const memoryContext = memories
      .map(m => m.summary)
      .join("\n");

    // 3. AI response
    const reply = await callMistral([
      {
        role: "system",
        content: "You are Operion Intelligence Core with selective memory."
      },
      {
        role: "user",
        content: `
Memory:
${memoryContext}

User:
${userMessage}
`
      }
    ]);

    // 4. 🧠 evaluate memory BEFORE saving
    const evaluation = await evaluateMemory(userMessage);

    if (evaluation.store && embedding) {
      await supabase.from("user_memory").insert([
        {
          user_id: userId,
          summary: evaluation.summary,
          embedding,
          importance: evaluation.importance,
          domain: "chat"
        }
      ]);
    }

    res.json({
      reply,
      stored: evaluation.store || false
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// -------------------------
// START
// -------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Operion Quality Memory System running");
});

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

// 🔥 EMBEDDING FUNCTION (MISTRAL)
async function getEmbedding(text) {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-embed",
      input: text
    })
  });

  const data = await res.json();
  return data.data[0].embedding;
}

// 🔥 VECTOR SEARCH
async function searchSimilarMemory(user_id, embedding) {
  const { data, error } = await supabase.rpc("match_memory", {
    query_embedding: embedding,
    match_user: user_id,
    match_count: 3
  });

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return data;
}

// TEST
app.get("/", (req, res) => {
  res.send("Operion Vector Brain 🧠🔍");
});

// MAIN
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // 🔹 CREATE EMBEDDING
    const embedding = await getEmbedding(message);

    // 🔹 SEARCH SIMILAR MEMORY
    const similarMemory = await searchSimilarMemory(user_id, embedding);

    const memoryText = similarMemory
      .map(m => m.message)
      .join("\n");

    // 🔹 AI RESPONSE
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
You are Operion Vector Intelligence.

Use relevant past knowledge if useful:

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

    // 🔹 STORE WITH EMBEDDING
    await supabase.from("user_memory").insert([
      {
        user_id,
        message,
        reply,
        embedding
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
  console.log("Operion Vector running on port", PORT);
});

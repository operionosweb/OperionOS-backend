import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =======================
// SUPABASE
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Operion backend stable" });
});

// =======================
// EMBEDDINGS (SAFE VERSION)
// =======================
async function getEmbedding(text) {
  // Placeholder safe fallback (prevents crashes)
  // Replace later with real embedding model if needed
  return Array(384).fill(0).map((_, i) =>
    Math.sin(text.length + i) / 10
  );
}

// =======================
// MISTRAL LLM
// =======================
async function llm(prompt) {
  try {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-medium",
        messages: [
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
        }
      }
    );

    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("LLM ERROR:", err.message);
    return "LLM error";
  }
}

// =======================
// MEMORY ENDPOINT (STABLE)
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. embedding (SAFE FIX: always 384 dims)
    const embedding = await getEmbedding(message);

    // 2. store memory (SAFE INSERT)
    const { error: insertError } = await supabase
      .from("user_memory")
      .insert([
        {
          user_id,
          summary: message,
          embedding
        }
      ]);

    if (insertError) {
      console.log("INSERT ERROR:", insertError.message);
    }

    // 3. retrieve memory (SAFE QUERY)
    const { data: memories } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .limit(5);

    // 4. response generation
    const context = (memories || [])
      .map(m => m.summary)
      .join("\n");

    const reply = await llm(`
You are a helpful AI assistant.

Context:
${context}

User:
${message}
`);

    return res.json({
      reply,
      memory_found: memories?.length || 0,
      memories: memories || []
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log("🚀 Operion backend stable running on port", PORT);
});

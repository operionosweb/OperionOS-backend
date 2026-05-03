import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ---------------- EMBEDDING ----------------
async function getEmbedding(text) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/embeddings",
    {
      model: "mistral-embed",
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
    }
  );

  return res.data.data[0].embedding;
}

// ---------------- LLM RESPONSE ----------------
async function getLLMResponse(prompt) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: "You are an intelligent AI with memory awareness." },
        { role: "user", content: prompt }
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
    }
  );

  return res.data.choices[0].message.content;
}

// ---------------- INTENT ----------------
function detectIntent(text) {
  const t = text.toLowerCase();

  if (t.includes("airbus") || t.includes("boeing")) return "aviation";
  if (t.includes("ship") || t.includes("maritime")) return "maritime";
  if (t.includes("offshore")) return "offshore";
  if (t.includes("what is") || t.includes("explain")) return "learning";

  return "general";
}

// ---------------- FINGERPRINT ----------------
function fingerprint(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const embedding = await getEmbedding(message);
    const intent = detectIntent(message);
    const fp = fingerprint(message);

    // 🔍 DUPLICATE CHECK
    const { data: existing } = await supabase
      .from("user_memory")
      .select("*")
      .eq("fingerprint", fp)
      .eq("user_id", user_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_memory")
        .update({
          importance: (existing.importance || 0.5) + 0.2,
          access_count: (existing.access_count || 0) + 1,
          last_accessed: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("user_memory").insert([
        {
          user_id,
          summary: message,
          embedding,
          importance: 0.5,
          access_count: 1,
          fingerprint: fp,
          intent,
          last_accessed: new Date().toISOString(),
        },
      ]);
    }

    // 🧠 RETRIEVE BEST MEMORIES (brain ranking)
    const { data: memories } = await supabase.rpc("match_memory", {
      query_embedding: embedding,
      match_user_id: user_id,
      match_count: 5,
    });

    // 🧠 BUILD CONTEXT
    const context = (memories || [])
      .map((m, i) => `Memory ${i + 1}: ${m.summary}`)
      .join("\n");

    // 🧠 FINAL PROMPT (THIS IS THE BRAIN)
    const finalPrompt = `
User message:
${message}

Relevant past memories:
${context}

Instructions:
- Use memory if relevant
- Be precise
- If no relevant memory, answer normally
`;

    // 🧠 LLM REASONING
    const reply = await getLLMResponse(finalPrompt);

    return res.json({
      reply,
      memory_used: memories?.length || 0,
      memories: memories || [],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Reasoning Engine v1 running");
});

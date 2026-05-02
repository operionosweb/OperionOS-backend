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

// ---------------- INTENT ----------------
function detectIntent(text) {
  const t = text.toLowerCase();

  if (t.includes("airbus") || t.includes("boeing")) return "aviation";
  if (t.includes("ship") || t.includes("maritime")) return "maritime";
  if (t.includes("drilling") || t.includes("offshore")) return "offshore";
  if (t.includes("what is") || t.includes("explain")) return "learning";

  return "general";
}

// ---------------- THREAD GENERATION ----------------
// simple but powerful: thread = intent + topic hash
function generateThreadId(intent, text) {
  const hash = crypto
    .createHash("md5")
    .update(text.toLowerCase().slice(0, 40))
    .digest("hex")
    .slice(0, 8);

  return `${intent}_${hash}`;
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
    const thread_id = generateThreadId(intent, message);
    const fp = fingerprint(message);

    // 🔍 DUPLICATE CHECK
    const { data: existing } = await supabase
      .from("user_memory")
      .select("*")
      .eq("fingerprint", fp)
      .eq("user_id", user_id)
      .maybeSingle();

    let insertError = null;

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
      const result = await supabase.from("user_memory").insert([
        {
          user_id,
          summary: message,
          embedding,
          importance: 0.5,
          access_count: 1,
          fingerprint: fp,
          intent,
          thread_id,
          last_accessed: new Date().toISOString(),
        },
      ]);

      insertError = result.error;
    }

    // 🧠 THREAD RETRIEVAL (key upgrade)
    const { data: memories } = await supabase
      .from("user_memory")
      .select("*")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true });

    return res.json({
      reply: "Cognitive thread system active",
      intent_detected: intent,
      thread_id,
      inserted_ok: !insertError,
      thread_length: memories?.length || 0,
      thread: memories || [],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Cognitive Threads v1 running");
});

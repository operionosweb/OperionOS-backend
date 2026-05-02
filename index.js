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
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.data[0].embedding;
}

// ---------------- FINGERPRINT ----------------
function createFingerprint(text) {
  return crypto
    .createHash("sha256")
    .update(text.toLowerCase().trim())
    .digest("hex");
}

// ---------------- CLUSTER ----------------
function getCluster(text) {
  const t = text.toLowerCase();

  if (t.includes("airbus") || t.includes("boeing")) return "aviation";
  if (t.includes("ship") || t.includes("marine")) return "maritime";
  if (t.includes("drilling") || t.includes("offshore")) return "offshore";

  return "general";
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const embedding = await getEmbedding(message);

    const fingerprint = createFingerprint(message);
    const cluster_id = getCluster(message);

    // 🔍 CHECK FOR DUPLICATE MEMORY
    const { data: existing } = await supabase
      .from("user_memory")
      .select("*")
      .eq("fingerprint", fingerprint)
      .eq("user_id", user_id)
      .maybeSingle();

    let insertError = null;

    if (existing) {
      // 🔥 If duplicate exists → boost importance instead of inserting
      await supabase
        .from("user_memory")
        .update({
          importance: (existing.importance || 0.5) + 0.2,
        })
        .eq("id", existing.id);
    } else {
      // 🧠 Insert new memory
      const result = await supabase.from("user_memory").insert([
        {
          user_id,
          summary: message,
          embedding,
          importance: 0.5,
          cluster_id,
          fingerprint,
        },
      ]);

      insertError = result.error;
    }

    // 🧠 SEARCH MEMORY
    const { data: memories } = await supabase.rpc("match_memory", {
      query_embedding: embedding,
      match_user_id: user_id,
      match_count: 5,
    });

    return res.json({
      reply: "Consolidation engine v2 active",
      inserted_ok: !insertError,
      duplicate_detected: !!existing,
      cluster: cluster_id,
      memory_found: memories?.length || 0,
      memories: memories || [],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🚀 Operion Intelligence Core v5 running");
});

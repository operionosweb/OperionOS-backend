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

// ---------------- SIMPLE CLUSTERING ----------------
// (temporary lightweight grouping logic)
function generateClusterId(text) {
  const lower = text.toLowerCase();

  if (lower.includes("airbus") || lower.includes("boeing")) return "aviation";
  if (lower.includes("ship") || lower.includes("maritime")) return "maritime";
  if (lower.includes("offshore") || lower.includes("drilling")) return "offshore";

  return "general";
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const embedding = await getEmbedding(message);

    const cluster_id = generateClusterId(message);

    // SAVE MEMORY WITH CLUSTERING
    const { error: insertError } = await supabase.from("user_memory").insert([
      {
        user_id,
        summary: message,
        embedding,
        importance: 0.5,
        cluster_id,
      },
    ]);

    // SEARCH MEMORY (ranked)
    const { data: memories } = await supabase.rpc("match_memory", {
      query_embedding: embedding,
      match_user_id: user_id,
      match_count: 5,
    });

    return res.json({
      reply: "Memory consolidation active",
      inserted_ok: !insertError,
      cluster_assigned: cluster_id,
      memory_found: memories?.length || 0,
      memories: memories || [],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🚀 Operion Intelligence Core v4 running");
});

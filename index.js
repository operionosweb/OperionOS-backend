import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// -------------------- INIT APP --------------------
const app = express();
app.use(cors());
app.use(express.json());

// -------------------- CONFIG --------------------
const PORT = process.env.PORT || 3000;

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!MISTRAL_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// -------------------- EMBEDDING --------------------
async function getEmbedding(text) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/embeddings",
    {
      model: "mistral-embed",
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.data[0].embedding;
}

// -------------------- HEALTH CHECK --------------------
app.get("/", (req, res) => {
  res.send("Operion Intelligence Core running 🚀");
});

// -------------------- DEBUG MEMORY ROUTE --------------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. EMBEDDING
    const queryEmbedding = await getEmbedding(message);

    // 2. VECTOR SEARCH
    const { data: memories, error } = await supabase.rpc("match_memory", {
      query_embedding: queryEmbedding,
      match_user_id: user_id,
      match_count: 5,
    });

    console.log("VECTOR RESULT:", memories);
    console.log("VECTOR ERROR:", error);

    // 3. RESPONSE
    return res.json({
      memory_found: memories?.length || 0,
      memories: memories || [],
      error: error || null,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

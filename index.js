import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// ---------------- APP INIT ----------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ---------------- ENV ----------------
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// ---------------- SUPABASE ----------------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.data[0].embedding;
}

// ---------------- HEALTH CHECK ----------------
app.get("/", (req, res) => {
  res.send("Operion Intelligence Core Running 🚀");
});

// ---------------- MESSAGE ROUTE (FULL FIX) ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon", domain = "general" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. CREATE EMBEDDING
    const embedding = await getEmbedding(message);

    // 2. INSERT MEMORY (FIXED)
    const { error: insertError } = await supabase.from("user_memory").insert([
      {
        user_id,
        summary: message,
        domain,
        embedding,
      },
    ]);

    if (insertError) {
      console.log("INSERT ERROR:", insertError);
    }

    // 3. VECTOR SEARCH
    const { data: memories, error: searchError } = await supabase.rpc(
      "match_memory",
      {
        query_embedding: embedding,
        match_user_id: user_id,
        match_count: 5,
      }
    );

    console.log("MEMORIES:", memories);
    console.log("SEARCH ERROR:", searchError);

    // 4. RESPONSE
    return res.json({
      message_received: message,
      inserted_ok: !insertError,
      memory_found: memories?.length || 0,
      memories: memories || [],
      insert_error: insertError || null,
      search_error: searchError || null,
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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
  res.json({
    status: "ok",
    system: "Operion AI stable (fast mode)"
  });
});

// =======================
// LLM (MISTRAL)
// =======================
async function llm(system, user) {
  try {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-medium",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
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
    console.error("LLM ERROR:", err.response?.data || err.message);
    return "LLM error";
  }
}

// =======================
// MAIN ENDPOINT (FAST + STABLE)
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // =======================
    // 1. GET MEMORY
    // =======================
    const { data: memoryData, error: memoryError } = await supabase
      .from("user_memory")
      .select("summary")
      .eq("user_id", user_id)
      .limit(5);

    if (memoryError) {
      console.log("MEMORY FETCH ERROR:", memoryError.message);
    }

    const context = (memoryData || [])
      .map(m => m.summary)
      .join("\n");

    // =======================
    // 2. SINGLE LLM CALL
    // =======================
    const reply = await llm(
      "You are an advanced multi-expert AI system (aviation, finance, operations).",
      `
Context:
${context}

User:
${message}

Respond clearly with:
1. Aviation perspective
2. Finance perspective
3. Operations perspective
4. Final combined answer
`
    );

    // =======================
    // 3. STORE MEMORY (NON-BLOCKING)
    // =======================
    supabase
      .from("user_memory")
      .insert([
        {
          user_id,
          summary: message
        }
      ])
      .then(() => {})
      .catch(err => console.log("MEMORY INSERT ERROR:", err.message));

    // =======================
    // 4. RESPONSE
    // =======================
    return res.json({
      reply
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Operion backend running on port ${PORT}`);
});

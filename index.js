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
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!MISTRAL_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("Operion Intelligence Core Running 🚀");
});

// MAIN ENDPOINT
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon", domain = "general" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🔹 GET MEMORY
    const { data: memory, error: memError } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (memError) {
      console.error("Memory fetch error:", memError);
    }

    const memoryContext = (memory || [])
      .map((m) => m.summary)
      .join("\n");

    // 🔹 AI CALL
    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `You are Operion Intelligence Core. Use memory if relevant.\n${memoryContext}`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    const reply = aiResponse.data.choices[0].message.content;

    // 🔹 SAVE MEMORY
    const { error: insertError } = await supabase.from("user_memory").insert([
      {
        user_id,
        summary: message,
        domain,
      },
    ]);

    if (insertError) {
      console.error("Memory insert error:", insertError);
    }

    res.json({
      reply,
      memory_used: memory?.length || 0,
    });
  } catch (error) {
    console.error("ERROR:", error.response?.data || error.message);

    res.status(500).json({
      error: "Something broke",
      details: error.response?.data || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ENV
const PORT = process.env.PORT || 3000;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// SUPABASE
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

    // 🔹 1. GET MEMORY (last 5)
    const { data: memory } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const memoryContext = memory?.map(m => m.summary).join("\n") || "";

    // 🔹 2. CALL MISTRAL
    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          {
            role: "system",
            content: `You are Operion Intelligence Core. Use memory if relevant.\n${memoryContext}`
          },
          {
            role: "user",
            content: message
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );

    const reply = aiResponse.data.choices[0].message.content;

    // 🔹 3. SAVE MEMORY
    await supabase.from("user_memory").insert([
      {
        user_id,
        summary: message,
        domain
      }
    ]);

    // 🔹 4. RESPONSE
    res.json({
      reply,
      memory_used: memory?.length || 0

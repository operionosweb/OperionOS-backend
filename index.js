import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Health check
app.get("/", (req, res) => {
  res.send("Operion Backend is Running 🚀");
});

// Test endpoint
app.post("/test3", (req, res) => {
  res.json({
    ok: true,
    message: "test3 endpoint works ✅",
    received: req.body
  });
});

// MAIN MESSAGE ENDPOINT
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🧠 OPERION SYSTEM PROMPT (OPTIMIZED)
    const systemPrompt = `
You are Operion — an elite industrial AI assistant.

RULES:
- Be concise and high-value.
- Default response length: 150–300 words MAX.
- Use structured format (headers, bullet points).
- Only go deep IF user explicitly asks for "deep dive".
- Prioritize clarity over completeness.
- Avoid long explanations unless requested.

DOMAIN FOCUS:
- Aviation
- Maritime
- Offshore
- Engineering systems

STYLE:
- Professional
- Technical
- Straight to the point
`;

    // 🔥 Call Mistral
    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 300 // 🔥 KEY FIX (prevents timeout)
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply =
      aiResponse.data.choices[0].message.content || "No response";

    // 💾 Store in Supabase (optional memory)
    await supabase.from("messages").insert([
      {
        user_message: userMessage,
        ai_reply: reply
      }
    ]);

    res.json({ reply });
  } catch (error) {
    console.error(error.response?.data || error

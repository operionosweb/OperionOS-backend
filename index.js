import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Health
app.get("/", (req, res) => {
  res.send("Operion Backend is Running 🚀");
});

// Test
app.post("/test3", (req, res) => {
  res.json({
    ok: true,
    message: "test3 endpoint works ✅",
    received: req.body
  });
});

// MESSAGE
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = `
You are Operion — an elite industrial AI assistant.

RULES:
- Be concise and high-value.
- STRICT LIMIT: 120–200 words MAX.
- ALWAYS finish your response completely.
- Never cut off mid-sentence.
- Use structured format (headers + bullet points).
- Only go deep if user explicitly asks for "deep dive".

DOMAIN:
- Aviation
- Maritime
- Offshore
- Engineering systems

STYLE:
- Technical
- Clear
- No fluff
`;

    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 250,   // slightly increased
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let reply =
      aiResponse.data.choices[0].message.content || "No response";

    // 🧠 Safety trim (prevents cut sentence at end)
    if (reply.length > 0 && !reply.trim().endsWith(".")) {
      reply = reply.substring(0, reply.lastIndexOf(".")) + ".";
    }

    // Save memory
    await supabase.from("messages").insert([
      {
        user_message: userMessage,
        ai_reply: reply
      }
    ]);

    res.json({ reply });

  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: "Something went wrong",
      details: error.response?.data || error.message
    });
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

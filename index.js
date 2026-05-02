import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 ENV
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ⏱ Timeout helper
const withTimeout = (promise, ms = 20000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);
};

// 🧠 DOMAIN DETECTION
function detectDomain(message) {
  const msg = message.toLowerCase();

  if (msg.includes("aircraft") || msg.includes("flight") || msg.includes("aviation")) {
    return "aviation";
  }
  if (msg.includes("ship") || msg.includes("marine") || msg.includes("vessel")) {
    return "maritime";
  }
  if (msg.includes("drilling") || msg.includes("rig") || msg.includes("offshore")) {
    return "offshore";
  }
  return "general";
}

// 🧠 SYSTEM PROMPTS
function getSystemPrompt(domain) {
  const base = "You are Operion AI. Give concise, structured, technical answers.";

  if (domain === "aviation") return base + " Focus on aircraft systems.";
  if (domain === "maritime") return base + " Focus on ship propulsion.";
  if (domain === "offshore") return base + " Focus on offshore drilling.";

  return base;
}

// 🚀 MAIN ENDPOINT
app.post("/message", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: "No message provided" });
  }

  const domain = detectDomain(userMessage);
  const systemPrompt = getSystemPrompt(domain);

  try {
    // ⚡ USE BUILT-IN fetch (NO node-fetch)
    const aiResponse = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          max_tokens: 300
        }),
      }),
      20000
    );

    const data = await aiResponse.json();

    const reply =
      data.choices?.[0]?.message?.content ||
      "No response generated.";

    // ⚡ NON-BLOCKING DB WRITE
    supabase.from("messages").insert([
      {
        user_message: userMessage,
        ai_reply: reply,
        domain: domain,
        created_at: new Date().toISOString(),
      },
    ]).then(() => {}).catch(() => {});

    return res.json({
      reply,
      domain,
    });

  } catch (error) {
    console.error("ERROR:", error.message);

    return res.json({
      reply: "Operion fallback response. Try again.",
      domain,
    });
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});

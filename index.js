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

// 🧠 DOMAIN DETECTION FUNCTION
function detectDomain(message) {
  const text = message.toLowerCase();

  if (
    text.includes("aircraft") ||
    text.includes("flight") ||
    text.includes("avionics") ||
    text.includes("fly-by-wire") ||
    text.includes("aviation")
  ) {
    return "aviation";
  }

  if (
    text.includes("ship") ||
    text.includes("vessel") ||
    text.includes("propulsion") ||
    text.includes("marine") ||
    text.includes("maritime")
  ) {
    return "maritime";
  }

  if (
    text.includes("drilling") ||
    text.includes("rig") ||
    text.includes("offshore") ||
    text.includes("mud") ||
    text.includes("well")
  ) {
    return "offshore";
  }

  return "general";
}

// 🧠 PROMPTS PER DOMAIN
function getSystemPrompt(domain) {
  const baseRules = `
RULES:
- STRICT LIMIT: 120–200 words
- Always finish sentences
- Use headers + bullet points
- Be concise, technical, high-value
`;

  if (domain === "aviation") {
    return `
You are Operion — Aviation Systems Engineer.

Focus:
- Flight control systems
- Avionics
- Aircraft architecture
- Safety & redundancy

${baseRules}
`;
  }

  if (domain === "maritime") {
    return `
You are Operion — Maritime Systems Engineer.

Focus:
- Ship propulsion
- Marine engineering
- Vessel systems
- Hydrodynamics

${baseRules}
`;
  }

  if (domain === "offshore") {
    return `
You are Operion — Offshore Drilling Engineer.

Focus:
- Drilling systems
- Mud engineering
- Well control
- Offshore operations

${baseRules}
`;
  }

  return `
You are Operion — Technical AI assistant.

Focus:
- Engineering systems
- Industrial domains

${baseRules}
`;
}

// MESSAGE
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🔥 Detect domain
    const domain = detectDomain(userMessage);

    // 🔥 Get specialized prompt
    const systemPrompt = getSystemPrompt(domain);

    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 250,
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

    // Trim incomplete ending
    if (reply.length > 0 && !reply.trim().endsWith(".")) {
      reply = reply.substring(0, reply.lastIndexOf(".")) + ".";
    }

    // Save with domain
    await supabase.from("messages").insert([
      {
        user_message: userMessage,
        ai_reply: reply,
        domain: domain
      }
    ]);

    res.json({ reply, domain });

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

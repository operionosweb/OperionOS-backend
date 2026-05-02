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

// DOMAIN DETECTION
function detectDomain(message) {
  const text = message.toLowerCase();

  if (/(aircraft|flight|avionics|fly-by-wire|aviation)/.test(text)) {
    return "aviation";
  }

  if (/(ship|vessel|marine|propulsion|maritime)/.test(text)) {
    return "maritime";
  }

  if (/(drilling|rig|offshore|mud|well)/.test(text)) {
    return "offshore";
  }

  return "general";
}

// PROMPTS
function getSystemPrompt(domain) {
  const base = `
You are Operion — an elite industrial AI system.

RULES:
- 120–220 words MAX
- ALWAYS finish cleanly (no cut sentences)
- Structured: headers + bullets
- Give practical engineering insight, not just definitions
- Think like a senior engineer, not a textbook
`;

  if (domain === "aviation") {
    return `
You are an Aviation Systems Engineer.

Focus:
- Flight control systems
- Redundancy & safety
- Real aircraft implementations (Airbus/Boeing mindset)
- Operational implications

${base}
`;
  }

  if (domain === "maritime") {
    return `
You are a Maritime Systems Engineer.

Focus:
- Propulsion efficiency
- Vessel operations
- Trade-offs (fuel, maneuverability, maintenance)
- Real-world ship configurations

${base}
`;
  }

  if (domain === "offshore") {
    return `
You are an Offshore Drilling Engineer.

Focus:
- Well control & pressure management
- Operational risks
- Field applications (deepwater, HPHT)
- Practical engineering decisions

${base}
`;
  }

  return `
You are a technical systems engineer.

${base}
`;
}

// MESSAGE
app.post("/message", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Message is required" });
    }

    const domain = detectDomain(userMessage);
    const systemPrompt = getSystemPrompt(domain);

    const aiResponse = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 280,
        temperature: 0.6
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

    // HARD CLEAN ENDING
    const lastPeriod = reply.lastIndexOf(".");
    if (lastPeriod > 0) {
      reply = reply.substring(0, lastPeriod + 1);
    }

    // Save
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

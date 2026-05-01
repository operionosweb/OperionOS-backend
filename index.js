const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* --------------------------------
   DOMAIN ROUTER (VERY SIMPLE v1)
-------------------------------- */
function detectDomain(text) {
  const t = text.toLowerCase();

  if (
    t.includes("aircraft") ||
    t.includes("aviation") ||
    t.includes("hydraulic") ||
    t.includes("flight") ||
    t.includes("avionics") ||
    t.includes("airplane")
  ) {
    return "aviation";
  }

  if (
    t.includes("ship") ||
    t.includes("maritime") ||
    t.includes("vessel") ||
    t.includes("port") ||
    t.includes("cargo")
  ) {
    return "maritime";
  }

  if (
    t.includes("offshore") ||
    t.includes("drilling") ||
    t.includes("rig") ||
    t.includes("oil") ||
    t.includes("gas")
  ) {
    return "offshore";
  }

  return "general";
}

/* --------------------------------
   SYSTEM PROMPTS PER DOMAIN
-------------------------------- */
function getSystemPrompt(domain) {
  const base = `
You are Operion, an industrial intelligence system.
Be structured, precise, and engineering-focused.
`;

  const aviation = `
${base}
Domain: Aviation Systems
Focus: aircraft systems, avionics, hydraulics, flight control, safety, propulsion.
`;

  const maritime = `
${base}
Domain: Maritime Systems
Focus: vessels, propulsion, navigation, port logistics, shipping operations.
`;

  const offshore = `
${base}
Domain: Offshore Systems
Focus: drilling systems, oil & gas infrastructure, offshore logistics, energy systems.
`;

  const general = `
${base}
Domain: General Engineering & Operations
Provide structured, practical explanations.
`;

  switch (domain) {
    case "aviation":
      return aviation;
    case "maritime":
      return maritime;
    case "offshore":
      return offshore;
    default:
      return general;
  }
}

/* --------------------------------
   MESSAGE ENDPOINT
-------------------------------- */
app.post("/message", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // 1. Detect domain
    const domain = detectDomain(message);

    // 2. Get last messages
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    const formattedHistory = (history || [])
      .reverse()
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    // 3. Build messages
    const messagesForAI = [
      {
        role: "system",
        content: getSystemPrompt(domain)
      },
      {
        role: "system",
        content: `Detected domain: ${domain}`
      },
      ...formattedHistory,
      {
        role: "user",
        content: message
      }
    ];

    // 4. Call Mistral
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "mistral-small",
        messages: messagesForAI,
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    // 5. Save memory
    await supabase.from("messages").insert([
      { role: "user", content: message }
    ]);

    await supabase.from("messages").insert([
      { role: "assistant", content: aiReply }
    ]);

    // 6. Response
    res.json({
      reply: aiReply,
      domain: domain
    });

  } catch (err) {
    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Operion routing failed"
    });
  }
});

/* --------------------------------
   START SERVER
-------------------------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Operion with domain routing active 🚀");
});

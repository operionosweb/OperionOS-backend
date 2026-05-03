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
// HEALTH
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    system: "Operion operations-first architecture"
  });
});

// =======================
// LLM
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
// DOMAIN DETECTOR
// =======================
function detectDomains(message) {
  const msg = message.toLowerCase();

  return {
    aviation: msg.includes("aircraft") || msg.includes("airline") || msg.includes("flight"),
    finance: msg.includes("cost") || msg.includes("revenue") || msg.includes("profit")
  };
}

// =======================
// MEMORY
// =======================
async function getMemory(user_id) {
  const { data } = await supabase
    .from("user_memory")
    .select("summary")
    .eq("user_id", user_id)
    .limit(5);

  return data || [];
}

async function storeMemory(user_id, message) {
  const { error } = await supabase
    .from("user_memory")
    .insert([{ user_id, summary: message }]);

  if (error) {
    console.log("MEMORY ERROR:", error.message);
  }
}

// =======================
// DOMAIN AGENTS (OPTIONAL)
// =======================
async function aviationAgent(message, context) {
  return llm(
    "You are an aviation expert. Provide insights only if relevant.",
    `Context:\n${context}\n\nUser:\n${message}`
  );
}

async function financeAgent(message, context) {
  return llm(
    "You are a finance expert. Provide insights only if relevant.",
    `Context:\n${context}\n\nUser:\n${message}`
  );
}

// =======================
// OPERATIONS CORE AGENT (PRIMARY BRAIN)
// =======================
async function operationsAgent(message, context, extras) {
  return llm(
    "You are OPERATIONS CORE AGENT. You make decisions, optimize systems, and produce actionable outputs. You integrate all inputs into a single operational recommendation.",
    `
Context:
${context}

Extra Domain Insights:
${JSON.stringify(extras)}

User:
${message}

Respond with:
- Key insight
- Operational analysis
- Step-by-step actions
- Final recommendation
`
  );
}

// =======================
// MAIN ENDPOINT
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. MEMORY
    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    // 2. DETECT DOMAINS
    const domains = detectDomains(message);

    // 3. OPTIONAL DOMAIN ENRICHMENT (CONTROLLED)
    const extras = {};

    if (domains.aviation) {
      extras.aviation = await aviationAgent(message, context);
    }

    if (domains.finance) {
      extras.finance = await financeAgent(message, context);
    }

    // 4. OPERATIONS CORE (ALWAYS RUNS LAST)
    const reply = await operationsAgent(message, context, extras);

    // 5. STORE MEMORY (NON-BLOCKING)
    storeMemory(user_id, message);

    // 6. RESPONSE
    return res.json({
      reply,
      domains,
      extras
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
});

// =======================
// START
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Operion operations-first running on port ${PORT}`);
});

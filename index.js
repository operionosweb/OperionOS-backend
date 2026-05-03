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
    system: "Operion operations-first + maritime module"
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
// DOMAIN DETECTION
// =======================
function detectDomains(message) {
  const msg = message.toLowerCase();

  return {
    maritime:
      msg.includes("ship") ||
      msg.includes("vessel") ||
      msg.includes("port") ||
      msg.includes("shipping") ||
      msg.includes("maritime") ||
      msg.includes("cargo sea"),

    aviation:
      msg.includes("aircraft") ||
      msg.includes("airline") ||
      msg.includes("flight"),

    finance:
      msg.includes("cost") ||
      msg.includes("revenue") ||
      msg.includes("profit")
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
// AGENTS
// =======================

// CORE OPERATIONS BRAIN (unchanged)
async function operationsAgent(message, context, extras) {
  return llm(
    "You are OPERATIONS CORE AGENT. You optimize complex systems (aviation, maritime, logistics, energy, industrial operations). You produce actionable operational decisions.",
    `
Context:
${context}

Domain Insights:
${JSON.stringify(extras)}

User Request:
${message}

Output:
- Key insight
- Operational analysis
- Step-by-step actions
- Risks / constraints
- Final recommendation
`
  );
}

// 🚢 MARITIME MODULE
async function maritimeAgent(message, context) {
  return llm(
    "You are a maritime operations expert (shipping, ports, vessels, offshore logistics, bunker fuel, fleet utilization).",
    `
Context:
${context}

User:
${message}

Focus on:
- shipping efficiency
- port operations
- vessel routing
- fuel (bunker) costs
- turnaround time
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

    // 2. DOMAIN DETECTION
    const domains = detectDomains(message);

    const extras = {};

    // 3. MARITIME MODULE (NEW)
    if (domains.maritime) {
      extras.maritime = await maritimeAgent(message, context);
    }

    // 4. OPTIONAL FINANCE (lightweight heuristic)
    if (domains.finance) {
      extras.finance = await llm(
        "You are a finance operations analyst.",
        `Context:\n${context}\n\nUser:\n${message}`
      );
    }

    // 5. CORE OPERATIONS BRAIN (FINAL DECIDER)
    const reply = await operationsAgent(message, context, extras);

    // 6. STORE MEMORY (NON-BLOCKING)
    storeMemory(user_id, message);

    // 7. RESPONSE
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
  console.log(`🚀 Operion OS running (maritime module active)`);
});

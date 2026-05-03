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
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    system: "Operion operations-first + maritime + offshore modules"
  });
});

// =======================
// LLM WRAPPER
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
      msg.includes("maritime"),

    offshore:
      msg.includes("rig") ||
      msg.includes("drilling") ||
      msg.includes("oil platform") ||
      msg.includes("offshore") ||
      msg.includes("subsea") ||
      msg.includes("energy platform"),

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
// CORE OPERATIONS BRAIN
// =======================
async function operationsAgent(message, context, extras) {
  return llm(
    "You are OPERATIONS CORE AGENT. You optimize complex real-world systems: aviation, maritime, offshore energy, logistics, industrial operations, and finance. You think in efficiency, constraints, cost, and execution.",
    `
Context:
${context}

Domain Insights:
${JSON.stringify(extras)}

User Request:
${message}

Output:
- Key insight
- Operational breakdown
- Step-by-step actions
- Risks / constraints
- Final optimized recommendation
`
  );
}

// =======================
// MARITIME MODULE
// =======================
async function maritimeAgent(message, context) {
  return llm(
    "You are a maritime operations expert focused on shipping, ports, vessel routing, bunker fuel, and logistics optimization.",
    `
Context:
${context}

User:
${message}

Analyze:
- port efficiency
- vessel routing
- shipping costs
- turnaround delays
- fuel consumption (bunker fuel)
`
  );
}

// =======================
// OFFSHORE MODULE (NEW)
// =======================
async function offshoreAgent(message, context) {
  return llm(
    "You are an offshore energy operations expert specializing in oil rigs, gas platforms, subsea operations, drilling efficiency, maintenance, and offshore logistics.",
    `
Context:
${context}

User:
${message}

Focus on:
- rig utilization & downtime
- drilling efficiency
- offshore logistics & supply vessels
- maintenance scheduling
- safety & operational risk
- energy production optimization
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

    // MEMORY
    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    // DOMAIN DETECTION
    const domains = detectDomains(message);

    const extras = {};

    // MARITIME
    if (domains.maritime) {
      extras.maritime = await maritimeAgent(message, context);
    }

    // OFFSHORE (NEW)
    if (domains.offshore) {
      extras.offshore = await offshoreAgent(message, context);
    }

    // FINANCE (light support)
    if (domains.finance) {
      extras.finance = await llm(
        "You are a finance operations analyst.",
        `Context:\n${context}\n\nUser:\n${message}`
      );
    }

    // CORE DECISION ENGINE
    const reply = await operationsAgent(message, context, extras);

    // MEMORY WRITE
    storeMemory(user_id, message);

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
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Operion OS running (maritime + offshore modules active)`);
});

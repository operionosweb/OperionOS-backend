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
// AGENTS (SAFE REINTRO)
// =======================
const AGENTS = {
  aviation: "You are an aviation expert (aircraft, airlines, operations).",
  finance: "You are a finance expert (costs, ROI, profitability).",
  operations: "You are an operations expert (efficiency, logistics).",
  general: "You are a general intelligent assistant."
};

// =======================
// HEALTH
// =======================
app.get("/", (req, res) => {
  res.json({ status: "ok", system: "Operion AI v2 stable" });
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
    console.error("LLM ERROR:", err.message);
    return "LLM error";
  }
}

// =======================
// SIMPLE ROUTER (ROBUST)
// =======================
function router(message) {
  const msg = message.toLowerCase();

  let domains = [];

  if (msg.includes("aircraft") || msg.includes("airline") || msg.includes("flight")) {
    domains.push("aviation");
  }

  if (msg.includes("cost") || msg.includes("revenue") || msg.includes("profit")) {
    domains.push("finance");
  }

  if (msg.includes("optimize") || msg.includes("efficiency") || msg.includes("process")) {
    domains.push("operations");
  }

  if (domains.length === 0) {
    domains.push("general");
  }

  return domains;
}

// =======================
// MEMORY (SAFE)
// =======================
async function getMemory(user_id) {
  const { data } = await supabase
    .from("user_memory")
    .select("*")
    .eq("user_id", user_id)
    .limit(5);

  return data || [];
}

async function storeMemory(user_id, summary) {
  await supabase.from("user_memory").insert([
    {
      user_id,
      summary
    }
  ]);
}

// =======================
// RUN AGENT
// =======================
async function runAgent(agent, message, context) {
  return await llm(
    AGENTS[agent],
    `
Context:
${context}

User:
${message}
`
  );
}

// =======================
// AGGREGATOR (SAFE)
// =======================
async function aggregate(results) {
  return await llm(
    "Combine expert answers into one clear response.",
    JSON.stringify(results, null, 2)
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

    // 2. ROUTE
    const domains = router(message);

    // 3. RUN AGENTS
    let results = {};

    for (const d of domains) {
      results[d] = await runAgent(d, message, context);
    }

    // 4. FINAL RESPONSE
    const final = await aggregate(results);

    // 5. STORE MEMORY
    await storeMemory(user_id, message);

    return res.json({
      reply: final,
      routing: domains,
      agents: results
    });

  } catch (err) {
    console.error("FATAL:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================
// START
// =======================
app.listen(PORT, () => {
  console.log("🚀 Operion AI v2 running on port", PORT);
});

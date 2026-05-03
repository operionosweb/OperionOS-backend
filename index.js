import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// =======================
// GLOBAL CONFIG (IMPORTANT)
// =======================
const AGENTS = {
  aviation: "Aviation expert focused on aircraft, airlines, operations",
  finance: "Finance expert focused on ROI, cost, profitability",
  operations: "Operations expert focused on efficiency and workflows",
  general: "General reasoning agent"
};

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
// LLM CALL
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
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
      }
    );

    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("LLM ERROR:", err.response?.data || err.message);
    return "LLM error";
  }
}

// =======================
// ROUTER
// =======================
async function router(message) {
  const prompt = `
Classify this request into domains:
aviation, finance, operations, general

Return JSON:
["domain1", "domain2"]
`;

  const res = await llm("You are a routing agent.", prompt + "\n\n" + message);

  try {
    const parsed = JSON.parse(res);
    return Array.isArray(parsed) ? parsed : ["general"];
  } catch {
    return ["general"];
  }
}

// =======================
// MEMORY FETCH
// =======================
async function getAgentMemory(agent, user_id) {
  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("agent", agent)
    .eq("user_id", user_id)
    .order("importance", { ascending: false })
    .limit(5);

  if (error) {
    console.log("MEMORY FETCH ERROR:", error);
    return [];
  }

  return data || [];
}

// =======================
// MEMORY STORE
// =======================
async function storeMemory(agent, user_id, summary, score) {
  const { error } = await supabase.from("agent_memory").insert([
    {
      agent,
      user_id,
      summary,
      success_score: score,
      importance: 0.5 + score * 0.5,
    },
  ]);

  if (error) {
    console.log("MEMORY INSERT ERROR:", error);
  }
}

// =======================
// RUN SINGLE AGENT
// =======================
async function runAgent(agent, message, user_id) {
  const memory = await getAgentMemory(agent, user_id);

  const context = memory.map(m => m.summary).join("\n");

  const result = await llm(
    AGENTS[agent],
    `
Past knowledge:
${context}

User message:
${message}

Respond clearly and helpfully.
`
  );

  // Evaluate answer
  const scoreText = await llm(
    "Score this answer from 0 to 1 (only number).",
    result
  );

  let score = parseFloat(scoreText);
  if (isNaN(score)) score = 0.5;

  await storeMemory(agent, user_id, result, score);

  return {
    result,
    score
  };
}

// =======================
// AGGREGATOR
// =======================
async function aggregate(results) {
  return await llm(
    "You combine multiple expert answers into one final answer.",
    JSON.stringify(results, null, 2)
  );
}

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.send("🧠 Operion Persistent Agent Organization running");
});

// =======================
// MAIN ENDPOINT
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    // 1. ROUTE
    const domains = await router(message);

    // 2. RUN AGENTS
    let results = {};

    for (const domain of domains) {
      if (AGENTS[domain]) {
        results[domain] = await runAgent(domain, message, user_id);
      }
    }

    // fallback safety
    if (Object.keys(results).length === 0) {
      results.general = await runAgent("general", message, user_id);
    }

    // 3. AGGREGATE
    const final = await aggregate(results);

    return res.json({
      reply: final,
      routing: domains,
      agents: results
    });

  } catch (err) {
    console.error("FATAL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

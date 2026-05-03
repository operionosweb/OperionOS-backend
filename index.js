import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// =======================
// AGENTS
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
Classify into:
aviation, finance, operations, general

Return JSON array only.
Message:
${message}
`;

  const res = await llm("Routing system", prompt);

  try {
    return JSON.parse(res);
  } catch {
    return ["general"];
  }
}

// =======================
// MEMORY FETCH (WITH ACCESS TRACKING)
// =======================
async function getDomainMemory(agent, user_id) {
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("agent", agent)
    .eq("user_id", user_id)
    .order("importance", { ascending: false })
    .limit(5);

  if (!data) return [];

  // update access stats
  for (const m of data) {
    await supabase
      .from("agent_memory")
      .update({
        access_count: (m.access_count || 0) + 1,
        last_accessed: new Date()
      })
      .eq("id", m.id);
  }

  return data;
}

// =======================
// STORE MEMORY
// =======================
async function storeLearning(agent, user_id, summary, quality) {
  await supabase.from("agent_memory").insert([
    {
      agent,
      user_id,
      domain: agent,
      summary,
      quality_score: quality,
      importance: 0.5 + quality * 0.5,
    },
  ]);
}

// =======================
// RUN AGENT
// =======================
async function runAgent(agent, message, user_id) {
  const memory = await getDomainMemory(agent, user_id);

  const context = memory.map(m => m.summary).join("\n");

  const result = await llm(
    AGENTS[agent],
    `
Relevant knowledge:
${context}

User:
${message}
`
  );

  const scoreText = await llm(
    "Score 0-1 quality only",
    result
  );

  let score = parseFloat(scoreText);
  if (isNaN(score)) score = 0.5;

  await storeLearning(agent, user_id, result, score);

  return { result, score };
}

// =======================
// AGGREGATE
// =======================
async function aggregate(results) {
  return await llm(
    "Combine expert outputs into one.",
    JSON.stringify(results, null, 2)
  );
}

// =======================
// DECAY + PRUNE TRIGGER
// =======================
async function maintainMemory() {
  try {
    await supabase.rpc("apply_memory_decay");
    await supabase.rpc("prune_memory");
  } catch (err) {
    console.log("MAINTENANCE ERROR:", err);
  }
}

// =======================
// ENDPOINT
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // run maintenance occasionally
    await maintainMemory();

    const domains = await router(message);

    let results = {};

    for (const d of domains) {
      if (AGENTS[d]) {
        results[d] = await runAgent(d, message, user_id);
      }
    }

    if (Object.keys(results).length === 0) {
      results.general = await runAgent("general", message, user_id);
    }

    const final = await aggregate(results);

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
  console.log("🧠 Memory decay system active");
});

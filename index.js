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
// ROUTER (STRONG)
// =======================
async function router(message) {
  const prompt = `
Classify into:
aviation, finance, operations, general

Rules:
- MUST choose best domain(s)
- NOT default to general unless necessary

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
// FETCH DOMAIN MEMORY
// =======================
async function getDomainMemory(agent, user_id) {
  const { data } = await supabase
    .from("agent_memory")
    .select("*")
    .eq("agent", agent)
    .eq("user_id", user_id)
    .order("quality_score", { ascending: false })
    .limit(5);

  return data || [];
}

// =======================
// STORE LEARNING
// =======================
async function storeLearning(agent, user_id, summary, quality) {
  const { error } = await supabase.from("agent_memory").insert([
    {
      agent,
      user_id,
      domain: agent,
      summary,
      pattern_type: "response",
      quality_score: quality,
      importance: 0.5 + quality * 0.5,
    },
  ]);

  if (error) {
    console.log("STORE ERROR:", error);
  }
}

// =======================
// RUN AGENT WITH LEARNING
// =======================
async function runAgent(agent, message, user_id) {
  const memory = await getDomainMemory(agent, user_id);

  const learnedContext = memory.map(m => m.summary).join("\n");

  const result = await llm(
    AGENTS[agent],
    `
You are improving over time.

Best past knowledge:
${learnedContext}

User:
${message}

Respond with the best possible domain expertise.
`
  );

  // Evaluate quality
  const scoreText = await llm(
    "Score this response quality from 0 to 1 (number only)",
    result
  );

  let score = parseFloat(scoreText);
  if (isNaN(score)) score = 0.5;

  await storeLearning(agent, user_id, result, score);

  return { result, score };
}

// =======================
// AGGREGATOR
// =======================
async function aggregate(results) {
  return await llm(
    "Combine expert outputs into one final high-quality answer.",
    JSON.stringify(results, null, 2)
  );
}

// =======================
// ENDPOINT
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message required" });
    }

    const domains = await router(message);

    let results = {};

    for (const domain of domains) {
      if (AGENTS[domain]) {
        results[domain] = await runAgent(domain, message, user_id);
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
  console.log("🧠 Domain Specialization Learning running");
});

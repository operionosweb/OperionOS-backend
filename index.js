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
    system: "Operion AI async multi-agent"
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
    return "Agent failed";
  }
}

// =======================
// AGENTS
// =======================
const AGENTS = {
  aviation: "You are an aviation expert (aircraft, airlines, operations).",
  finance: "You are a finance expert (costs, ROI, profitability).",
  operations: "You are an operations expert (efficiency, logistics)."
};

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

// =======================
// AGENT EXECUTION
// =======================
async function runAgent(agentName, message, context) {
  return llm(
    AGENTS[agentName],
    `
Context:
${context}

User:
${message}
`
  );
}

// =======================
// AGGREGATOR
// =======================
async function aggregate(results) {
  return llm(
    "You combine expert answers into one clear, concise, high-quality response.",
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

    // =======================
    // 1. MEMORY
    // =======================
    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    // =======================
    // 2. PARALLEL AGENTS
    // =======================
    const agentNames = Object.keys(AGENTS);

    const agentPromises = agentNames.map(agent =>
      runAgent(agent, message, context)
    );

    const agentResultsArray = await Promise.all(agentPromises);

    const agentResults = {};
    agentNames.forEach((name, i) => {
      agentResults[name] = agentResultsArray[i];
    });

    // =======================
    // 3. AGGREGATE
    // =======================
    const finalReply = await aggregate(agentResults);

    // =======================
    // 4. STORE MEMORY (NON-BLOCKING)
    // =======================
    supabase.from("user_memory").insert([
      { user_id, summary: message }
    ]).catch(() => {});

    // =======================
    // 5. RESPONSE
    // =======================
    return res.json({
      reply: finalReply,
      agents: agentResults
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
  console.log(`🚀 Operion AI async multi-agent running on port ${PORT}`);
});

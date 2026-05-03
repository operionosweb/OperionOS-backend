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
    system: "Operion AI hybrid agents (stable)"
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
// AGENTS (REDUCED)
// =======================
const AGENTS = {
  aviation: "You are an aviation expert.",
  finance: "You are a finance expert."
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

async function storeMemory(user_id, message) {
  const { error } = await supabase
    .from("user_memory")
    .insert([{ user_id, summary: message }]);

  if (error) {
    console.log("MEMORY INSERT ERROR:", error.message);
  }
}

// =======================
// AGENT RUN
// =======================
async function runAgent(agent, message, context) {
  return llm(
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
// SIMPLE MERGE (NO LLM)
// =======================
function mergeResults(results) {
  return `
AVIATION INSIGHT:
${results.aviation}

FINANCIAL INSIGHT:
${results.finance}

FINAL:
Combine both perspectives to give a clear, practical answer.
`;
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

    // 2. RUN 2 AGENTS (PARALLEL)
    const [aviation, finance] = await Promise.all([
      runAgent("aviation", message, context),
      runAgent("finance", message, context)
    ]);

    const results = { aviation, finance };

    // 3. MERGE (NO EXTRA API CALL)
    const reply = mergeResults(results);

    // 4. STORE MEMORY (SAFE)
    storeMemory(user_id, message);

    return res.json({
      reply,
      agents: results
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
  console.log(`🚀 Operion AI hybrid running on port ${PORT}`);
});

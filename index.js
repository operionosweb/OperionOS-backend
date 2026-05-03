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
// MEMORY (USER)
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

  if (error) console.log("MEMORY ERROR:", error.message);
}

// =======================
// SIMPLE PERSISTENT LEARNING STORE
// (NEW: agent performance tracking)
// =======================
async function logAgentPerformance(agent, usefulnessScore) {
  await supabase.from("agent_feedback").insert([
    {
      agent,
      score: usefulnessScore,
      created_at: new Date().toISOString()
    }
  ]);
}

async function getAgentWeights() {
  const { data } = await supabase
    .from("agent_feedback")
    .select("agent, score");

  const weights = {
    aviation: 1,
    maritime: 1,
    offshore: 1,
    finance: 1
  };

  if (!data) return weights;

  for (const row of data) {
    if (weights[row.agent] !== undefined) {
      weights[row.agent] += row.score * 0.01;
    }
  }

  return weights;
}

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
// AGENTS
// =======================
async function aviationAgent(input, context) {
  return llm(
    "Aviation operations expert focused on airlines, fleets, fuel, efficiency.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function maritimeAgent(input, context) {
  return llm(
    "Maritime expert focused on shipping, ports, vessels, bunker fuel optimization.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function offshoreAgent(input, context) {
  return llm(
    "Offshore energy expert focused on rigs, drilling, subsea operations, logistics.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function financeAgent(input, context) {
  return llm(
    "Finance operations analyst focused on cost, ROI, profitability.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

// =======================
// 🧠 ADAPTIVE PLANNER (IMPROVED)
// =======================
async function planner(message) {
  const lower = message.toLowerCase();

  const weights = await getAgentWeights();

  const plan = {
    aviation: 0,
    maritime: 0,
    offshore: 0,
    finance: 0
  };

  if (lower.match(/airline|flight|aircraft/)) {
    plan.aviation = 1 * weights.aviation;
  }

  if (lower.match(/ship|port|vessel|shipping/)) {
    plan.maritime = 1 * weights.maritime;
  }

  if (lower.match(/offshore|rig|drilling|platform/)) {
    plan.offshore = 1 * weights.offshore;
  }

  if (lower.match(/cost|profit|revenue|roi/)) {
    plan.finance = 1 * weights.finance;
  }

  return plan;
}

// =======================
// SYNTHESIZER
// =======================
async function synthesizer(message, context, outputs) {
  return llm(
    "You are an operations orchestration engine combining expert outputs into one optimized decision.",
    `
User:
${message}

Context:
${context}

Agent Outputs:
${JSON.stringify(outputs)}
`
  );
}

// =======================
// FEEDBACK ENDPOINT (NEW)
// =======================
app.post("/feedback", async (req, res) => {
  const { agent, score } = req.body;

  if (!agent || typeof score !== "number") {
    return res.status(400).json({ error: "invalid feedback" });
  }

  await logAgentPerformance(agent, score);

  res.json({ status: "logged" });
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

    const memory = await getMemory(user_id);
    const context = memory.map(m => m.summary).join("\n");

    const plan = await planner(message);

    const outputs = {};

    const tasks = [];

    if (plan.aviation) {
      tasks.push(
        aviationAgent(message, context).then(r => (outputs.aviation = r))
      );
    }

    if (plan.maritime) {
      tasks.push(
        maritimeAgent(message, context).then(r => (outputs.maritime = r))
      );
    }

    if (plan.offshore) {
      tasks.push(
        offshoreAgent(message, context).then(r => (outputs.offshore = r))
      );
    }

    if (plan.finance) {
      tasks.push(
        financeAgent(message, context).then(r => (outputs.finance = r))
      );
    }

    await Promise.all(tasks);

    const reply = await synthesizer(message, context, outputs);

    storeMemory(user_id, message);

    return res.json({
      reply,
      plan,
      outputs,
      note: "system is now learning from feedback endpoint"
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
  console.log("🚀 Self-improving orchestration layer active");
});

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
    system: "Operion unified multi-agent orchestration layer active"
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
// DOMAIN AGENTS
// =======================
async function maritimeAgent(input, context) {
  return llm(
    "Maritime operations expert (ports, shipping, vessels, bunker fuel). Return structured operational insight.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function offshoreAgent(input, context) {
  return llm(
    "Offshore energy expert (oil rigs, drilling, subsea, platforms, logistics). Return structured operational insight.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function aviationAgent(input, context) {
  return llm(
    "Aviation operations expert (airlines, fleets, fuel efficiency, routing). Return structured operational insight.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

async function financeAgent(input, context) {
  return llm(
    "Finance operations analyst (cost, ROI, profitability, optimization). Return structured insight.",
    `Context:\n${context}\n\nInput:\n${input}`
  );
}

// =======================
// 🧠 PLANNER (NEW ORCHESTRATION CORE)
// =======================
async function planner(message) {
  const lower = message.toLowerCase();

  const plan = {
    aviation: false,
    maritime: false,
    offshore: false,
    finance: false
  };

  if (
    lower.includes("airline") ||
    lower.includes("flight") ||
    lower.includes("aircraft")
  ) plan.aviation = true;

  if (
    lower.includes("ship") ||
    lower.includes("port") ||
    lower.includes("vessel") ||
    lower.includes("shipping")
  ) plan.maritime = true;

  if (
    lower.includes("rig") ||
    lower.includes("offshore") ||
    lower.includes("drilling") ||
    lower.includes("platform")
  ) plan.offshore = true;

  if (
    lower.includes("cost") ||
    lower.includes("profit") ||
    lower.includes("revenue")
  ) plan.finance = true;

  return plan;
}

// =======================
// 🧠 SYNTHESIZER (NEW)
// =======================
async function synthesizer(message, context, outputs) {
  return llm(
    "You are the OPERATIONS ORCHESTRATOR. You combine multiple expert outputs into a single optimized operational decision.",
    `
User Request:
${message}

Context:
${context}

Agent Outputs:
${JSON.stringify(outputs)}

Task:
- Merge insights
- Resolve contradictions
- Prioritize actions
- Produce final operational recommendation
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

    // 🧠 ORCHESTRATION PLAN
    const plan = await planner(message);

    const outputs = {};

    // EXECUTE AGENTS IN PARALLEL
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

    // 🧠 FINAL SYNTHESIS
    const reply = await synthesizer(message, context, outputs);

    // MEMORY WRITE
    storeMemory(user_id, message);

    return res.json({
      reply,
      plan,
      outputs
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
  console.log("🚀 Operion unified orchestration layer active");
});

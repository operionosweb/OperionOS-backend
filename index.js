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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ---------------- GENERIC LLM ----------------
async function llm(system, user) {
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
}

// ---------------- AGENTS ----------------

// 🎯 Planner
async function plannerAgent(goal, message) {
  const prompt = `
Goal:
${goal.goal}

User message:
${message}

Create a clear plan of what to do next.
`;

  return await llm(
    "You are a strategic planning agent.",
    prompt
  );
}

// 🔧 Executor
async function executorAgent(plan) {
  const prompt = `
Plan:
${plan}

Execute this plan and produce a result.
`;

  return await llm(
    "You are an execution agent that follows instructions precisely.",
    prompt
  );
}

// 🔍 Critic
async function criticAgent(goal, result) {
  const prompt = `
Goal:
${goal.goal}

Result:
${result}

Evaluate:
- correctness
- usefulness
- improvements

Respond clearly.
`;

  return await llm(
    "You are a critical evaluator agent.",
    prompt
  );
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // GET GOAL
    const { data: goal } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!goal) {
      return res.json({ reply: "No active goal" });
    }

    // ---------------- MULTI-AGENT FLOW ----------------

    // 1️⃣ PLAN
    const plan = await plannerAgent(goal, message);

    await supabase.from("agent_interactions").insert([
      { user_id, role: "planner", message: plan },
    ]);

    // 2️⃣ EXECUTE
    const result = await executorAgent(plan);

    await supabase.from("agent_interactions").insert([
      { user_id, role: "executor", message: result },
    ]);

    // 3️⃣ CRITIC
    const critique = await criticAgent(goal, result);

    await supabase.from("agent_interactions").insert([
      { user_id, role: "critic", message: critique },
    ]);

    return res.json({
      reply: "Multi-agent cycle complete",
      agents: {
        planner: plan,
        executor: result,
        critic: critique,
      },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Multi-Agent System v1 running");
});

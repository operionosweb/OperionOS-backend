import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ---------------- LLM ----------------
async function llm(prompt) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: "You are a self-improving AI agent." },
        { role: "user", content: prompt }
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

// ---------------- TOOLS ----------------
async function searchTool(query) {
  return `Search result: Airbus uses fly-by-wire systems.`;
}

async function fetchTool(url) {
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data.toString().slice(0, 1000);
  } catch {
    return "Fetch failed";
  }
}

async function executeTool(name, input) {
  if (name === "search") return await searchTool(input);
  if (name === "fetch") return await fetchTool(input);
  return null;
}

// ---------------- HELPERS ----------------
function fingerprint(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ---------------- EVALUATION ----------------
async function evaluateAction(goal, step) {
  const prompt = `
Goal:
${goal.goal}

Action:
${step.action}

Result:
${step.result}

Was this useful?

Respond JSON:
{
  "score": 0 to 1,
  "feedback": "short explanation"
}
`;

  const res = await llm(prompt);

  try {
    return JSON.parse(res);
  } catch {
    return { score: 0.5, feedback: "uncertain" };
  }
}

// ---------------- AGENT LOOP ----------------
async function runAgentLoop(goal, message, user_id) {
  let steps = [];
  let context = "";

  for (let i = 0; i < 3; i++) {
    const decisionPrompt = `
Goal:
${goal.goal}

Context:
${context}

User message:
${message}

Decide next step.

Respond JSON:
{
  "tool": "search | fetch | none",
  "input": "...",
  "action": "..."
}
`;

    const decisionText = await llm(decisionPrompt);

    let decision;
    try {
      decision = JSON.parse(decisionText);
    } catch {
      break;
    }

    if (!decision.tool || decision.tool === "none") break;

    const result = await executeTool(decision.tool, decision.input);

    const step = {
      action: decision.action,
      tool: decision.tool,
      result,
    };

    // 🔍 EVALUATE STEP
    const evaluation = await evaluateAction(goal, step);

    // 💾 SAVE ACTION
    await supabase.from("agent_actions").insert([
      {
        user_id,
        goal_id: goal.id,
        tool: decision.tool,
        action: decision.action,
        result,
        score: evaluation.score,
        feedback: evaluation.feedback,
        status: "completed",
      },
    ]);

    // 🧠 UPDATE MEMORY SIGNAL (reinforcement)
    await supabase
      .from("user_memory")
      .update({
        success_score: evaluation.score,
      })
      .eq("user_id", user_id)
      .limit(1); // simple v1 signal

    context += `
Action: ${decision.action}
Result: ${result}
Score: ${evaluation.score}
`;

    steps.push({
      ...step,
      evaluation,
    });
  }

  return steps;
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const fp = fingerprint(message);

    // MEMORY STORE
    const { data: existing } = await supabase
      .from("user_memory")
      .select("*")
      .eq("fingerprint", fp)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existing) {
      await supabase.from("user_memory").insert([
        {
          user_id,
          summary: message,
          importance: 0.5,
          access_count: 1,
          fingerprint: fp,
          last_accessed: new Date().toISOString(),
        },
      ]);
    }

    // ACTIVE GOAL
    const { data: goal } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    let steps = null;

    if (goal) {
      steps = await runAgentLoop(goal, message, user_id);
    }

    return res.json({
      reply: "Self-improving agent executed",
      steps,
      has_goal: !!goal,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Self-Improving Agent v1 running");
});

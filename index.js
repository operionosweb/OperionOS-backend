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
        { role: "system", content: "You are an autonomous agent that thinks step-by-step." },
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

// ---------------- AGENT LOOP ----------------
async function runAgentLoop(goal, message, user_id) {
  let steps = [];
  let context = "";
  let lastAction = null;

  for (let i = 0; i < 3; i++) {
    const prompt = `
Goal:
${goal.goal}

Plan:
${JSON.stringify(goal.plan)}

Context so far:
${context}

User message:
${message}

Previous action:
${lastAction || "none"}

Decide next step.

Respond JSON:
{
  "tool": "search | fetch | none",
  "input": "...",
  "thought": "...",
  "action": "..."
}
`;

    const response = await llm(prompt);

    let decision;
    try {
      decision = JSON.parse(response);
    } catch {
      break;
    }

    // stop if no tool
    if (!decision.tool || decision.tool === "none") break;

    // stop if repeating same action
    if (decision.action === lastAction) break;

    const toolResult = await executeTool(decision.tool, decision.input);

    // store step
    steps.push({
      step: i + 1,
      thought: decision.thought,
      action: decision.action,
      tool: decision.tool,
      result: toolResult,
    });

    // update context
    context += `
Step ${i + 1}:
Action: ${decision.action}
Result: ${toolResult}
`;

    lastAction = decision.action;

    // save to DB
    await supabase.from("agent_actions").insert([
      {
        user_id,
        goal_id: goal.id,
        tool: decision.tool,
        action: decision.action,
        result: toolResult,
        status: "completed",
      },
    ]);
  }

  return steps;
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const fp = fingerprint(message);

    // ---------------- MEMORY ----------------
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

    // ---------------- ACTIVE GOAL ----------------
    const { data: goal } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let loopSteps = null;

    if (goal) {
      loopSteps = await runAgentLoop(goal, message, user_id);
    }

    return res.json({
      reply: "Agent loop executed",
      steps: loopSteps,
      has_goal: !!goal,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Agent Loop v1 running");
});

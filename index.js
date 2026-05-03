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
        { role: "system", content: "You are a meta-learning AI agent." },
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
  return `Search: Airbus uses fly-by-wire systems.`;
}

async function fetchTool(url) {
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data.toString().slice(0, 1000);
  } catch {
    return "Fetch failed";
  }
}

async function executeTool(tool, input) {
  if (tool === "search") return await searchTool(input);
  if (tool === "fetch") return await fetchTool(input);
  return null;
}

// ---------------- STRATEGY SELECT ----------------
async function getBestStrategy(user_id) {
  const { data } = await supabase
    .from("agent_strategies")
    .select("*")
    .eq("user_id", user_id)
    .order("avg_score", { ascending: false })
    .limit(1);

  return data?.[0]?.strategy || "direct_reasoning";
}

// ---------------- STRATEGY UPDATE ----------------
async function updateStrategy(user_id, strategy, score) {
  const { data: existing } = await supabase
    .from("agent_strategies")
    .select("*")
    .eq("user_id", user_id)
    .eq("strategy", strategy)
    .maybeSingle();

  if (existing) {
    const newCount = existing.usage_count + 1;
    const newAvg =
      (existing.avg_score * existing.usage_count + score) / newCount;

    await supabase
      .from("agent_strategies")
      .update({
        avg_score: newAvg,
        usage_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("agent_strategies").insert([
      {
        user_id,
        strategy,
        avg_score: score,
        usage_count: 1,
      },
    ]);
  }
}

// ---------------- AGENT LOOP ----------------
async function runAgent(goal, message, user_id) {
  const strategy = await getBestStrategy(user_id);

  let tool = "none";

  if (strategy === "search_first") tool = "search";
  if (strategy === "fetch_first") tool = "fetch";

  const decisionPrompt = `
Goal:
${goal.goal}

Strategy:
${strategy}

User message:
${message}

Decide next action.

Respond JSON:
{
  "tool": "${tool} or none",
  "input": "...",
  "action": "..."
}
`;

  const decisionText = await llm(decisionPrompt);

  let decision;
  try {
    decision = JSON.parse(decisionText);
  } catch {
    decision = { tool: "none", action: decisionText };
  }

  const result =
    decision.tool && decision.tool !== "none"
      ? await executeTool(decision.tool, decision.input)
      : "No tool used";

  // ---------------- EVALUATE ----------------
  const evalPrompt = `
Goal:
${goal.goal}

Action:
${decision.action}

Result:
${result}

Score from 0 to 1:
`;

  const evalText = await llm(evalPrompt);

  let score = parseFloat(evalText);
  if (isNaN(score)) score = 0.5;

  // ---------------- UPDATE STRATEGY ----------------
  await updateStrategy(user_id, strategy, score);

  return {
    strategy,
    decision,
    result,
    score,
  };
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // ACTIVE GOAL
    const { data: goal } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    let output = null;

    if (goal) {
      output = await runAgent(goal, message, user_id);
    }

    return res.json({
      reply: "Meta-learning agent executed",
      meta: output,
      has_goal: !!goal,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Meta-Learning Agent running");
});

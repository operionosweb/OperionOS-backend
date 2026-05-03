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

// ---------------- LLM ----------------
async function llm(prompt) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: "You are a self-designing AI agent." },
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

// ---------------- GET BEST STRATEGY ----------------
async function getBestStrategy(user_id) {
  const { data } = await supabase
    .from("agent_strategies")
    .select("*")
    .eq("user_id", user_id)
    .order("avg_score", { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

// ---------------- GENERATE NEW STRATEGY ----------------
async function generateStrategy(goal) {
  const prompt = `
Goal:
${goal.goal}

Invent a new strategy to solve this better.

Respond JSON:
{
  "strategy": "short_name",
  "description": "what it does"
}
`;

  const res = await llm(prompt);

  try {
    return JSON.parse(res);
  } catch {
    return null;
  }
}

// ---------------- TEST STRATEGY ----------------
async function testStrategy(strategy, goal, message) {
  const prompt = `
Goal:
${goal.goal}

Strategy:
${strategy.description}

User message:
${message}

Execute this strategy and respond with result.
`;

  const result = await llm(prompt);

  const evalPrompt = `
Evaluate usefulness from 0 to 1:

Result:
${result}
`;

  const scoreText = await llm(evalPrompt);

  let score = parseFloat(scoreText);
  if (isNaN(score)) score = 0.5;

  return { result, score };
}

// ---------------- UPDATE CANDIDATE ----------------
async function updateCandidate(candidate, score) {
  const newCount = candidate.usage_count + 1;
  const newAvg =
    (candidate.avg_score * candidate.usage_count + score) / newCount;

  let status = "testing";

  if (newCount >= 3) {
    status = newAvg > 0.6 ? "approved" : "rejected";
  }

  await supabase
    .from("agent_strategy_candidates")
    .update({
      avg_score: newAvg,
      usage_count: newCount,
      status,
    })
    .eq("id", candidate.id);

  return status;
}

// ---------------- PROMOTE STRATEGY ----------------
async function promoteStrategy(user_id, candidate) {
  await supabase.from("agent_strategies").insert([
    {
      user_id,
      strategy: candidate.strategy,
      avg_score: candidate.avg_score,
      usage_count: candidate.usage_count,
    },
  ]);
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

    let result;

    // 30% chance to try new strategy
    if (Math.random() < 0.3) {
      const newStrategy = await generateStrategy(goal);

      if (newStrategy) {
        const { data: candidate } = await supabase
          .from("agent_strategy_candidates")
          .insert([
            {
              user_id,
              strategy: newStrategy.strategy,
              description: newStrategy.description,
            },
          ])
          .select()
          .single();

        const test = await testStrategy(newStrategy, goal, message);

        const status = await updateCandidate(candidate, test.score);

        if (status === "approved") {
          await promoteStrategy(user_id, candidate);
        }

        result = {
          type: "new_strategy",
          strategy: newStrategy,
          test,
          status,
        };
      }
    } else {
      const best = await getBestStrategy(user_id);

      if (best) {
        const test = await testStrategy(
          { description: best.strategy },
          goal,
          message
        );

        result = {
          type: "existing_strategy",
          strategy: best.strategy,
          test,
        };
      }
    }

    return res.json({
      reply: "Self-designing agent executed",
      result,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Self-Designing Agent running");
});

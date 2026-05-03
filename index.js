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

// 🅰️ Agent A
async function agentA(goal, message) {
  return await llm(
    "You are Agent A: analytical and structured.",
    `Goal:\n${goal.goal}\n\nUser:\n${message}\n\nProvide a solution.`
  );
}

// 🅱️ Agent B
async function agentB(goal, message) {
  return await llm(
    "You are Agent B: creative and alternative thinker.",
    `Goal:\n${goal.goal}\n\nUser:\n${message}\n\nProvide a different approach.`
  );
}

// 🧨 Critique
async function critique(agentName, own, other) {
  return await llm(
    `You are ${agentName} critiquing another agent.`,
    `Your answer:\n${own}\n\nOther answer:\n${other}\n\nCritique weaknesses of the other.`
  );
}

// ⚖️ Judge
async function judge(goal, a, b, critiqueA, critiqueB) {
  return await llm(
    "You are a judge selecting the best solution.",
    `
Goal:
${goal.goal}

Agent A:
${a}

Agent B:
${b}

Critique A:
${critiqueA}

Critique B:
${critiqueB}

Choose the best answer or combine them into a superior one.
Explain briefly.
`
  );
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

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

    // 1️⃣ PROPOSALS
    const A = await agentA(goal, message);
    const B = await agentB(goal, message);

    // 2️⃣ CRITIQUES
    const critiqueA = await critique("Agent A", A, B);
    const critiqueB = await critique("Agent B", B, A);

    // 3️⃣ JUDGMENT
    const final = await judge(goal, A, B, critiqueA, critiqueB);

    // OPTIONAL LOGGING
    await supabase.from("agent_debates").insert([
      { user_id, role: "A", message: A },
      { user_id, role: "B", message: B },
      { user_id, role: "critiqueA", message: critiqueA },
      { user_id, role: "critiqueB", message: critiqueB },
      { user_id, role: "judge", message: final },
    ]);

    return res.json({
      reply: final,
      debate: {
        agentA: A,
        agentB: B,
        critiqueA,
        critiqueB,
      },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Debate System v1 running");
});

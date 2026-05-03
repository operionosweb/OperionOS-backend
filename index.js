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
        { role: "system", content: "You are an autonomous AI agent." },
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

// ---------------- EMBEDDING ----------------
async function getEmbedding(text) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/embeddings",
    {
      model: "mistral-embed",
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
    }
  );

  return res.data.data[0].embedding;
}

// ---------------- HELPERS ----------------
function fingerprint(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const embedding = await getEmbedding(message);
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
          embedding,
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

    let agent_output = null;

    if (goal) {
      // ---------------- GET PAST ACTIONS ----------------
      const { data: actions } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("goal_id", goal.id);

      const actionHistory = (actions || [])
        .map(a => `- ${a.action} → ${a.result || "pending"}`)
        .join("\n");

      // ---------------- AGENT THINKING ----------------
      const agentPrompt = `
Goal:
${goal.goal}

Plan:
${JSON.stringify(goal.plan)}

Previous actions:
${actionHistory}

User message:
${message}

Decide:
1. Next best action
2. Why
3. Expected result

Respond in JSON:
{
  "action": "...",
  "reason": "...",
  "expected": "..."
}
`;

      const decisionText = await llm(agentPrompt);

      let decision;

      try {
        decision = JSON.parse(decisionText);
      } catch {
        decision = { action: decisionText };
      }

      // ---------------- SAVE ACTION ----------------
      const { data: newAction } = await supabase
        .from("agent_actions")
        .insert([
          {
            user_id,
            goal_id: goal.id,
            action: decision.action,
            result: decision.expected || null,
            status: "completed",
          },
        ])
        .select()
        .single();

      agent_output = {
        decision,
        action_saved: newAction,
      };
    }

    return res.json({
      reply: "Autonomous agent step executed",
      agent: agent_output,
      has_goal: !!goal,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Autonomous Agent v1 running");
});

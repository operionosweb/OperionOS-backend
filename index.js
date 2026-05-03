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

// ---------------- LLM ----------------
async function llm(prompt) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: "You are an AI planning assistant." },
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

// ---------------- HELPERS ----------------
function fingerprint(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function isGoal(text) {
  const t = text.toLowerCase();
  return (
    t.includes("i want to") ||
    t.includes("help me build") ||
    t.includes("plan") ||
    t.includes("how do i create")
  );
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    const embedding = await getEmbedding(message);
    const fp = fingerprint(message);

    // ---------------- MEMORY STORE ----------------
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

    // ---------------- GOAL DETECTION ----------------
    let goalData = null;

    if (isGoal(message)) {
      const planPrompt = `
User goal:
${message}

Create a structured plan in JSON with steps.
Format:
{
  "steps": ["step1", "step2", "step3"]
}
`;

      const planText = await llm(planPrompt);

      try {
        const planJson = JSON.parse(planText);

        const { data } = await supabase
          .from("user_goals")
          .insert([
            {
              user_id,
              goal: message,
              plan: planJson,
            },
          ])
          .select()
          .single();

        goalData = data;
      } catch (e) {
        goalData = { error: "Failed to parse plan", raw: planText };
      }
    }

    // ---------------- FETCH ACTIVE GOAL ----------------
    const { data: activeGoal } = await supabase
      .from("user_goals")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ---------------- MEMORY RETRIEVAL ----------------
    const { data: memories } = await supabase.rpc("match_memory", {
      query_embedding: embedding,
      match_user_id: user_id,
      match_count: 5,
    });

    // ---------------- CONTEXT ----------------
    const memoryContext = (memories || [])
      .map((m, i) => `Memory ${i + 1}: ${m.summary}`)
      .join("\n");

    const goalContext = activeGoal
      ? `Active goal: ${activeGoal.goal}\nPlan: ${JSON.stringify(activeGoal.plan)}`
      : "No active goal";

    const finalPrompt = `
User message:
${message}

${goalContext}

Relevant memories:
${memoryContext}

Instructions:
- If a goal exists, guide progress
- If no goal, respond normally
`;

    const reply = await llm(finalPrompt);

    return res.json({
      reply,
      goal_created: goalData || null,
      active_goal: activeGoal || null,
      memory_used: memories?.length || 0,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Planning Engine v1 running");
});

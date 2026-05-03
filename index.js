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
        { role: "system", content: "You are an autonomous AI agent with tools." },
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

// ---------------- TOOLS ----------------
async function searchTool(query) {
  // simple mock (replace later with real API)
  return `Search results for "${query}": Airbus uses fly-by-wire control systems.`;
}

async function fetchTool(url) {
  try {
    const res = await axios.get(url, { timeout: 5000 });
    return res.data.toString().slice(0, 1000);
  } catch {
    return "Failed to fetch URL";
  }
}

// ---------------- TOOL EXECUTOR ----------------
async function executeTool(name, input) {
  if (name === "search") return await searchTool(input);
  if (name === "fetch") return await fetchTool(input);

  return "Unknown tool";
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
      // ---------------- AGENT DECISION ----------------
      const decisionPrompt = `
Goal:
${goal.goal}

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
        decision = { tool: "none", action: decisionText };
      }

      // ---------------- EXECUTE TOOL ----------------
      let toolResult = null;

      if (decision.tool && decision.tool !== "none") {
        toolResult = await executeTool(decision.tool, decision.input);
      }

      // ---------------- SAVE ACTION ----------------
      const { data: saved } = await supabase
        .from("agent_actions")
        .insert([
          {
            user_id,
            goal_id: goal.id,
            tool: decision.tool,
            action: decision.action,
            result: toolResult,
            status: "completed",
          },
        ])
        .select()
        .single();

      agent_output = {
        decision,
        tool_result: toolResult,
        saved,
      };
    }

    return res.json({
      reply: "Tool execution complete",
      agent: agent_output,
      has_goal: !!goal,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Autonomous Agent v2 running");
});

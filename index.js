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

// ---------------- ROUTER ----------------
async function routerAgent(message) {
  const prompt = `
Classify this request into domains:
- aviation
- finance
- operations
- general

Return JSON:
{
  "domains": ["..."]
}
`;

  const res = await llm("You are a routing agent.", `${prompt}\n\n${message}`);

  try {
    return JSON.parse(res).domains;
  } catch {
    return ["general"];
  }
}

// ---------------- SPECIALIST AGENTS ----------------

async function aviationAgent(message) {
  return await llm(
    "You are an aviation expert.",
    message
  );
}

async function financeAgent(message) {
  return await llm(
    "You are a finance expert.",
    message
  );
}

async function operationsAgent(message) {
  return await llm(
    "You are an operations optimization expert.",
    message
  );
}

async function generalAgent(message) {
  return await llm(
    "You are a general reasoning AI.",
    message
  );
}

// ---------------- AGENT EXECUTION ----------------
async function runAgents(domains, message) {
  let results = {};

  if (domains.includes("aviation")) {
    results.aviation = await aviationAgent(message);
  }

  if (domains.includes("finance")) {
    results.finance = await financeAgent(message);
  }

  if (domains.includes("operations")) {
    results.operations = await operationsAgent(message);
  }

  if (domains.includes("general") || domains.length === 0) {
    results.general = await generalAgent(message);
  }

  return results;
}

// ---------------- AGGREGATOR ----------------
async function aggregatorAgent(results) {
  const prompt = `
Combine these expert outputs into one clear answer:

${JSON.stringify(results, null, 2)}
`;

  return await llm(
    "You are an aggregator combining expert outputs.",
    prompt
  );
}

// ---------------- MESSAGE ----------------
app.post("/message", async (req, res) => {
  try {
    const { message, user_id = "anon" } = req.body;

    // 1️⃣ ROUTE
    const domains = await routerAgent(message);

    // 2️⃣ EXECUTE
    const results = await runAgents(domains, message);

    // 3️⃣ AGGREGATE
    const final = await aggregatorAgent(results);

    // LOG
    for (const [agent, msg] of Object.entries(results)) {
      await supabase.from("agent_network_logs").insert([
        { user_id, agent, message: msg },
      ]);
    }

    return res.json({
      reply: final,
      routing: domains,
      raw: results,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🧠 Operion Distributed Agent Network running");
});

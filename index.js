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

// =======================
// SUPABASE
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =======================
// ENVIRONMENT
// =======================
async function getWeather() {
  try {
    const res = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3851&longitude=2.1734&current_weather=true"
    );
    return res.data.current_weather;
  } catch {
    return null;
  }
}

async function getAviation() {
  try {
    const res = await axios.get(
      "https://opensky-network.org/api/states/all"
    );
    return res.data.states?.length || 6000;
  } catch {
    return 6000;
  }
}

// =======================
// ENV MODEL
// =======================
function envModel(weather, aviationCount) {
  const wind = weather?.windspeed || 10;

  return {
    weatherRisk:
      wind > 45 ? "EXTREME" :
      wind > 30 ? "HIGH" :
      wind > 20 ? "MODERATE" :
      "LOW",

    congestionRisk:
      aviationCount > 8500 ? "HIGH" :
      aviationCount > 6500 ? "MEDIUM" :
      "LOW",

    wind,
    traffic: aviationCount
  };
}

// =======================
// AGENTS (NEW CORE)
// =======================
const AGENTS = {
  safety: {
    weight: 1.4,
    vote: (env) => {
      if (env.weatherRisk === "EXTREME") return "HOLD";
      if (env.weatherRisk === "HIGH") return "DELAY";
      return "PROCEED";
    }
  },

  cost: {
    weight: 1.0,
    vote: (env) => {
      if (env.congestionRisk === "HIGH") return "DELAY";
      if (env.congestionRisk === "MEDIUM") return "REROUTE";
      return "PROCEED";
    }
  },

  efficiency: {
    weight: 1.2,
    vote: (env) => {
      if (env.traffic > 8000) return "REROUTE";
      if (env.traffic > 7000) return "DELAY";
      return "PROCEED";
    }
  },

  operations: {
    weight: 1.5,
    vote: (env) => {
      if (env.weatherRisk === "HIGH" && env.congestionRisk === "HIGH")
        return "HOLD";

      if (env.weatherRisk === "MODERATE")
        return "DELAY";

      return "PROCEED";
    }
  }
};

// =======================
// VOTING ENGINE (NEW CORE)
// =======================
function negotiationEngine(env) {
  const votes = {};

  for (const [name, agent] of Object.entries(AGENTS)) {
    const decision = agent.vote(env);

    votes[name] = {
      decision,
      weight: agent.weight
    };
  }

  const score = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const v of Object.values(votes)) {
    score[v.decision] += v.weight;
  }

  const finalDecision = Object.entries(score)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    votes,
    score,
    finalDecision
  };
}

// =======================
// SIMPLE LLM (OPTIONAL EXPLANATION)
// =======================
async function llm(system, user) {
  const res = await axios.post(
    "https://api.mistral.ai/v1/chat/completions",
    {
      model: "mistral-medium",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content;
}

// =======================
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    const weather = await getWeather();
    const aviation = await getAviation();

    const env = envModel(weather, aviation);

    const negotiation = negotiationEngine(env);

    const explanation = await llm(
      "You are an operations council interpreter.",
      `
ENVIRONMENT:
${JSON.stringify(env)}

AGENT VOTES:
${JSON.stringify(negotiation.votes)}

SCORES:
${JSON.stringify(negotiation.score)}

FINAL DECISION:
${negotiation.finalDecision}

TASK:
Explain:
- why each agent voted as it did
- why final decision won
- operational reasoning
`
    );

    res.json({
      reply: explanation,
      environment: env,
      negotiation
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Multi-Agent Negotiation Engine Active");
});

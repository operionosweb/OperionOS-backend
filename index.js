import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// =======================
// ENVIRONMENT MODEL
// =======================
function envModel(weather, aviation) {
  const wind = weather?.windspeed || 10;

  return {
    weatherRisk:
      wind > 45 ? "EXTREME" :
      wind > 30 ? "HIGH" :
      wind > 20 ? "MODERATE" :
      "LOW",

    congestionRisk:
      aviation > 8500 ? "HIGH" :
      aviation > 6500 ? "MEDIUM" :
      "LOW",

    wind,
    traffic: aviation
  };
}

// =======================
// AGENTS (WITH ARGUMENTATION)
// =======================
const AGENTS = {
  safety: {
    weight: 1.5,
    propose: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" :
      env.weatherRisk === "HIGH" ? "DELAY" :
      "PROCEED",

    argue: (env, others) => {
      if (env.weatherRisk === "EXTREME") {
        return "Weather risk is too high for operational safety.";
      }
      if (others.cost === "PROCEED" && env.weatherRisk === "HIGH") {
        return "Cost optimization ignores safety degradation.";
      }
      return "Safety risk acceptable under current conditions.";
    }
  },

  cost: {
    weight: 1.0,
    propose: (env) =>
      env.congestionRisk === "HIGH" ? "DELAY" :
      env.congestionRisk === "MEDIUM" ? "REROUTE" :
      "PROCEED",

    argue: (env, others) => {
      if (others.safety === "HOLD") {
        return "Safety is over-conservative; cost impact is excessive.";
      }
      if (env.congestionRisk === "HIGH") {
        return "Delaying reduces operational inefficiency costs.";
      }
      return "Cost pressure is within acceptable thresholds.";
    }
  },

  efficiency: {
    weight: 1.2,
    propose: (env) =>
      env.traffic > 8000 ? "REROUTE" :
      env.traffic > 7000 ? "DELAY" :
      "PROCEED",

    argue: (env, others) => {
      if (others.safety === "HOLD") {
        return "Efficiency must yield to extreme safety conditions.";
      }
      if (others.cost === "PROCEED" && env.traffic > 8000) {
        return "Network congestion makes current routing suboptimal.";
      }
      return "Operational flow is stable.";
    }
  },

  operations: {
    weight: 1.6,
    propose: (env) => {
      if (env.weatherRisk === "HIGH" && env.congestionRisk === "HIGH")
        return "HOLD";
      if (env.weatherRisk === "MODERATE")
        return "DELAY";
      return "PROCEED";
    },

    argue: (env, others) => {
      if (others.safety === "HOLD") {
        return "Operations fully support safety-first override.";
      }
      if (others.cost === "PROCEED" && env.weatherRisk === "HIGH") {
        return "Operational exposure too high for continued execution.";
      }
      return "System stable for execution.";
    }
  }
};

// =======================
// 🔥 DEBATE ENGINE (NEW CORE)
// =======================
function debateEngine(env) {
  const initialProposals = {};
  const argumentsLog = {};

  // STEP 1: Initial proposals
  for (const [name, agent] of Object.entries(AGENTS)) {
    initialProposals[name] = agent.propose(env);
  }

  // STEP 2: Debate phase (rebuttals)
  for (const [name, agent] of Object.entries(AGENTS)) {
    argumentsLog[name] = agent.argue(env, initialProposals);
  }

  // STEP 3: Influence adjustment (simple rule-based shift)
  const influenceScore = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const [name, agent] of Object.entries(AGENTS)) {
    const vote = initialProposals[name];
    let weight = agent.weight;

    // safety arguments increase HOLD weight
    if (name === "safety" && env.weatherRisk === "EXTREME") {
      weight += 1;
    }

    // operations can override cost in high risk
    if (name === "operations" && env.weatherRisk === "HIGH") {
      weight += 0.5;
    }

    influenceScore[vote] += weight;
  }

  // STEP 4: Final decision
  const finalDecision = Object.entries(influenceScore)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    initialProposals,
    argumentsLog,
    influenceScore,
    finalDecision
  };
}

// =======================
// SIMPLE ENV FETCH (SIMPLIFIED)
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
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    const weather = await getWeather();
    const aviation = await getAviation();

    const env = envModel(weather, aviation);

    const debate = debateEngine(env);

    res.json({
      reply: "Debate complete. See structured reasoning output.",
      environment: env,
      debate
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Agent Debate Layer Active");
});

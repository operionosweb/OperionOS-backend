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
// INITIAL AGENT WEIGHTS (PERSISTENT STATE)
// =======================
let AGENT_WEIGHTS = {
  safety: 1.6,
  cost: 1.0,
  efficiency: 1.2,
  operations: 1.5
};

// =======================
// ENV MODEL
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
// AGENTS (NOW WEIGHTED)
// =======================
const AGENTS = {
  safety: (env) =>
    env.weatherRisk === "EXTREME" ? "HOLD" :
    env.weatherRisk === "HIGH" ? "DELAY" :
    "PROCEED",

  cost: (env) =>
    env.congestionRisk === "HIGH" ? "DELAY" :
    "PROCEED",

  efficiency: (env) =>
    env.traffic > 8000 ? "REROUTE" : "PROCEED",

  operations: (env) =>
    env.weatherRisk === "HIGH" && env.congestionRisk === "HIGH"
      ? "HOLD"
      : "PROCEED"
};

// =======================
// DEBATE ENGINE
// =======================
function debateEngine(env) {
  const proposals = {};
  const score = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const [name, fn] of Object.entries(AGENTS)) {
    const decision = fn(env);
    proposals[name] = decision;

    score[decision] += AGENT_WEIGHTS[name];
  }

  const finalDecision = Object.entries(score)
    .sort((a, b) => b[1] - a[1])[0][0];

  return { proposals, score, finalDecision };
}

// =======================
// META-REFLECTION (QUALITY CHECK)
// =======================
function metaReflection(env, debate) {
  const issues = [];
  const { proposals, finalDecision } = debate;

  if (proposals.safety === "HOLD" && finalDecision !== "HOLD") {
    issues.push("Safety overridden");
  }

  if (env.weatherRisk === "HIGH" && finalDecision === "PROCEED") {
    issues.push("High weather risk ignored");
  }

  const confidence = Math.max(0, 1 - issues.length * 0.3);

  return { issues, confidence };
}

// =======================
// 🔁 RECURSIVE SELF-IMPROVEMENT LOOP (NEW CORE)
// =======================
function selfImprove(meta, debate) {
  const { issues, confidence } = meta;

  const learningRate = 0.05; // slow adaptation (critical)

  // If system performed well → reinforce winning agents
  if (confidence > 0.7) {
    for (const agent of Object.keys(AGENT_WEIGHTS)) {
      AGENT_WEIGHTS[agent] += learningRate;
    }
  }

  // If system performed poorly → penalize conflicting agents
  if (issues.length > 0) {
    for (const issue of issues) {
      if (issue.includes("Safety")) {
        AGENT_WEIGHTS.safety = Math.min(
          2.0,
          AGENT_WEIGHTS.safety + 0.1
        );
      }

      if (issue.includes("weather")) {
        AGENT_WEIGHTS.operations = Math.min(
          2.0,
          AGENT_WEIGHTS.operations + 0.1
        );
      }
    }
  }

  // Clamp weights (CRITICAL SAFETY BOUNDARY)
  for (const k in AGENT_WEIGHTS) {
    AGENT_WEIGHTS[k] = Math.max(
      0.5,
      Math.min(2.0, AGENT_WEIGHTS[k])
    );
  }

  return { updatedWeights: AGENT_WEIGHTS };
}

// =======================
// ENV FETCH
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
// MAIN LOOP
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    const weather = await getWeather();
    const aviation = await getAviation();

    const env = envModel(weather, aviation);

    const debate = debateEngine(env);

    const meta = metaReflection(env, debate);

    const learning = selfImprove(meta, debate);

    res.json({
      reply: "Recursive learning cycle complete.",
      environment: env,
      debate,
      meta,
      learning
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Recursive Self-Improvement Engine Active");
  console.log("Initial weights:", AGENT_WEIGHTS);
});

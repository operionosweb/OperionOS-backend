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
// AGENTS
// =======================
const AGENTS = {
  safety: {
    weight: 1.6,
    propose: (env) =>
      env.weatherRisk === "EXTREME" ? "HOLD" :
      env.weatherRisk === "HIGH" ? "DELAY" :
      "PROCEED"
  },

  cost: {
    weight: 1.0,
    propose: (env) =>
      env.congestionRisk === "HIGH" ? "DELAY" :
      "PROCEED"
  },

  efficiency: {
    weight: 1.2,
    propose: (env) =>
      env.traffic > 8000 ? "REROUTE" : "PROCEED"
  },

  operations: {
    weight: 1.5,
    propose: (env) =>
      env.weatherRisk === "HIGH" && env.congestionRisk === "HIGH"
        ? "HOLD"
        : "PROCEED"
  }
};

// =======================
// DEBATE ENGINE
// =======================
function debateEngine(env) {
  const proposals = {};

  for (const [name, agent] of Object.entries(AGENTS)) {
    proposals[name] = agent.propose(env);
  }

  const score = {
    PROCEED: 0,
    DELAY: 0,
    REROUTE: 0,
    HOLD: 0
  };

  for (const [name, agent] of Object.entries(AGENTS)) {
    const vote = proposals[name];
    score[vote] += agent.weight;
  }

  const finalDecision = Object.entries(score)
    .sort((a, b) => b[1] - a[1])[0][0];

  return { proposals, score, finalDecision };
}

// =======================
// 🧠 META-REFLECTION AGENT (NEW CORE)
// =======================
function metaReflectionEngine(env, debate) {
  const issues = [];
  const strengths = [];

  const { proposals, finalDecision } = debate;

  // Bias detection: safety ignored?
  if (
    proposals.safety === "HOLD" &&
    finalDecision !== "HOLD"
  ) {
    issues.push("Safety signal was overridden by other agents.");
  }

  // Cost over-prioritization detection
  if (
    proposals.cost === "PROCEED" &&
    finalDecision === "PROCEED" &&
    env.weatherRisk === "HIGH"
  ) {
    issues.push("Cost bias may have overridden weather risk.");
  }

  // Efficiency vs safety conflict
  if (
    proposals.efficiency !== proposals.safety &&
    finalDecision === proposals.efficiency
  ) {
    issues.push("Efficiency dominated safety disagreement.");
  }

  // Balanced decision check
  if (
    proposals.safety === finalDecision ||
    proposals.operations === finalDecision
  ) {
    strengths.push("Decision aligned with safety/operations priorities.");
  }

  // stability check
  if (issues.length === 0) {
    strengths.push("No critical reasoning conflicts detected.");
  }

  const confidence =
    Math.max(0, 1 - issues.length * 0.25);

  return {
    issues,
    strengths,
    confidence: Number(confidence.toFixed(2))
  };
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
// MAIN
// =======================
app.post("/message", async (req, res) => {
  try {
    const { message } = req.body;

    const weather = await getWeather();
    const aviation = await getAviation();

    const env = envModel(weather, aviation);

    const debate = debateEngine(env);

    const meta = metaReflectionEngine(env, debate);

    res.json({
      reply: "Debate + meta-reflection complete.",
      environment: env,
      debate,
      metaReflection: meta
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
app.listen(PORT, () => {
  console.log("🧠 Meta-Reflection Engine Active");
});

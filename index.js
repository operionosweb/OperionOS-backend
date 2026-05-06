import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// =========================
// MIDDLEWARE
// =========================
app.use(cors());
app.use(express.json());

// =========================
// STRIPE INIT
// =========================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =========================
// IN-MEMORY STORAGE (TEMP)
// =========================
let workflows = {};
let actions = {}; // <-- NEW: stores approval-required actions

// =========================
// HEALTH CHECK
// =========================
app.get('/', (req, res) => {
  res.send('Operion Backend Running');
});

// =========================
// SYSTEM EXECUTION (SIMULATION)
// =========================
app.post('/execute/:tenantId', (req, res) => {
  const { tenantId } = req.params;

  const systemData = {
    tenantId,
    decision: Math.random() > 0.5 ? "OPTIMIZE" : "STABLE",
    healthScore: Math.floor(Math.random() * 100),
    load: {
      loadLevel: ["LOW", "MEDIUM", "HIGH"][
        Math.floor(Math.random() * 3)
      ]
    },
    timestamp: new Date().toISOString()
  };

  res.json(systemData);
});

// =========================
// SYSTEM HEALTH
// =========================
app.get('/control/:tenantId/health', (req, res) => {
  const { tenantId } = req.params;

  res.json({
    tenantId,
    systemStatus: "OK",
    uptime: Math.random().toFixed(2),
    alerts: Math.floor(Math.random() * 5),
    timestamp: new Date().toISOString()
  });
});

// =========================
// SAVE WORKFLOW
// =========================
app.post('/workflow/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  const workflow = req.body;

  if (!workflows[tenantId]) workflows[tenantId] = [];

  workflows[tenantId].push(workflow);

  res.json({
    message: "Workflow saved",
    total: workflows[tenantId].length
  });
});

// =========================
// GET WORKFLOWS
// =========================
app.get('/workflow/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  res.json(workflows[tenantId] || []);
});

// =========================
// WORKFLOW ENGINE → ACTION ENGINE
// =========================
app.post('/workflow/:tenantId/run', async (req, res) => {
  const { tenantId } = req.params;
  const systemData = req.body;

  const tenantWorkflows = workflows[tenantId] || [];
  if (!actions[tenantId]) actions[tenantId] = [];

  let triggered = [];

  for (const wf of tenantWorkflows) {
    let match = false;

    // =========================
    // CONDITION ENGINE
    // =========================
    if (wf.trigger_type === "FLEET_RISK") {
      if (systemData.healthScore < 70) match = true;
    }

    if (wf.trigger_type === "LOAD_SPIKE") {
      if (systemData.load?.loadLevel === "HIGH") match = true;
    }

    // =========================
    // ACTION ENGINE (PROPOSE)
    // =========================
    if (match) {
      const newAction = {
        id: Date.now() + Math.random(),
        workflow: wf.name,
        trigger: wf.trigger_type,
        status: "PENDING_APPROVAL",
        suggestedAction: generateActionSuggestion(systemData),
        systemData,
        createdAt: new Date().toISOString()
      };

      actions[tenantId].push(newAction);
      triggered.push(newAction);
    }
  }

  res.json({
    triggeredCount: triggered.length,
    triggered
  });
});

// =========================
// AI-LIKE ACTION SUGGESTION
// =========================
function generateActionSuggestion(systemData) {
  if (systemData.healthScore < 50) {
    return "Immediate intervention required: reassign resources and initiate contingency protocol.";
  }

  if (systemData.load?.loadLevel === "HIGH") {
    return "Load balancing recommended: redistribute workload across available fleet.";
  }

  return "Monitor system closely. No immediate action required.";
}

// =========================
// GET ACTIONS (APPROVAL QUEUE)
// =========================
app.get('/actions/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  res.json(actions[tenantId] || []);
});

// =========================
// APPROVE ACTION
// =========================
app.post('/actions/:tenantId/:actionId/approve', (req, res) => {
  const { tenantId, actionId } = req.params;

  const tenantActions = actions[tenantId] || [];

  const action = tenantActions.find(a => a.id == actionId);

  if (!action) {
    return res.status(404).json({ error: "Action not found" });
  }

  action.status = "APPROVED";
  action.executedAt = new Date().toISOString();

  // Simulated execution
  action.executionResult = "Action successfully executed.";

  res.json(action);
});

// =========================
// REJECT ACTION
// =========================
app.post('/actions/:tenantId/:actionId/reject', (req, res) => {
  const { tenantId, actionId } = req.params;

  const tenantActions = actions[tenantId] || [];

  const action = tenantActions.find(a => a.id == actionId);

  if (!action) {
    return res.status(404).json({ error: "Action not found" });
  }

  action.status = "REJECTED";

  res.json(action);
});

// =========================
// STRIPE CHECKOUT SESSION
// =========================
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, companyId } = req.body;

    if (!priceId || !companyId) {
      return res.status(400).json({
        error: 'Missing priceId or companyId'
      });
    }

    const successUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/billing-success`
      : 'https://example.com/billing-success';

    const cancelUrl = process.env.FRONTEND_URL
      ? `${process.env.FRONTEND_URL}/billing`
      : 'https://example.com/billing';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { companyId }
    });

    return res.json({ url: session.url });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Operion backend running on port ${PORT}`);
});

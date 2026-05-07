import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();

// =====================
// Middleware
// =====================
app.use(cors());
app.use(express.json());

// =====================
// Health check route
// =====================
app.get("/", (req, res) => {
  res.send("Operion backend running");
});

// =====================
// Test API route
// =====================
app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    message: "API is working"
  });
});

// =====================
// Stripe setup (safe init)
// =====================
let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  console.log("Stripe initialized");
} else {
  console.log("Stripe key missing (skipping init)");
}

// =====================
// Example endpoint (safe)
// =====================
app.post("/api/checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: "Stripe not configured"
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: req.body.items || [],
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel"
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// Server start
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("===================================");
  console.log("🚀 Operion backend started");
  console.log("🌍 Port:", PORT);
  console.log("===================================");
});

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * HEALTH CHECK
 */
app.get('/', (req, res) => {
  res.send('Operion Backend Running');
});

/**
 * CREATE CHECKOUT SESSION
 */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, companyId } = req.body;

    console.log("REQUEST:", { priceId, companyId });

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
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyId
      }
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error("STRIPE ERROR:", error);

    return res.status(500).json({
      error: error.message
    });
  }
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

/**
 * CREATE STRIPE CHECKOUT SESSION
 */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, companyId } = req.body;

    if (!priceId || !companyId) {
      return res.status(400).json({
        error: 'Missing priceId or companyId'
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL}/billing-success`,
      cancel_url: `${process.env.FRONTEND_URL}/billing`,
      metadata: {
        companyId: companyId
      }
    });

    return res.json({
      url: session.url
    });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * HEALTH CHECK
 */
app.get('/', (req, res) => {
  res.send('Operion Backend Running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

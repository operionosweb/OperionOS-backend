app.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, companyId } = req.body;

    console.log("👉 REQUEST RECEIVED");
    console.log("priceId:", priceId);
    console.log("companyId:", companyId);

    if (!priceId || !companyId) {
      return res.status(400).json({
        error: 'Missing priceId or companyId'
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: 'Missing STRIPE_SECRET_KEY in environment'
      });
    }

    console.log("👉 Creating Stripe session...");

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
        companyId
      }
    });

    console.log("👉 SESSION CREATED:", session.id);

    return res.json({ url: session.url });

  } catch (error) {
    console.error("🔥 FULL STRIPE ERROR:");
    console.error(error); // THIS IS THE IMPORTANT PART

    return res.status(500).json({
      error: error.message,
      raw: error
    });
  }
});

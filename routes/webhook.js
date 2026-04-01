const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');

const PLAN_MAP = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY]: { plan: 'pro', tokens_limit: 8000000 },
  [process.env.STRIPE_PRICE_PRO_YEARLY]: { plan: 'pro', tokens_limit: 8000000 },
  [process.env.STRIPE_PRICE_BIZ_MONTHLY]: { plan: 'business', tokens_limit: 50000000 },
  [process.env.STRIPE_PRICE_BIZ_YEARLY]: { plan: 'business', tokens_limit: 50000000 },
};

// POST /api/webhook/stripe — Stripe webhook (raw body required)
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata?.supabase_uid;
        if (!uid) break;

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price.id;
        const planInfo = PLAN_MAP[priceId] || { plan: 'pro', tokens_limit: 8000000 };

        await supabaseAdmin.from('profiles').update({
          plan: planInfo.plan,
          tokens_limit: planInfo.tokens_limit,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          updated_at: new Date().toISOString()
        }).eq('id', uid);

        console.log(`✅ User ${uid} upgraded to ${planInfo.plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) break;

        if (subscription.status === 'active') {
          const priceId = subscription.items.data[0]?.price.id;
          const planInfo = PLAN_MAP[priceId] || { plan: 'pro', tokens_limit: 8000000 };
          await supabaseAdmin.from('profiles').update({
            plan: planInfo.plan,
            tokens_limit: planInfo.tokens_limit,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await supabaseAdmin.from('profiles').update({
            plan: 'free',
            tokens_limit: 500000,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);
          console.log(`⬇️ User ${profile.id} downgraded to free`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`⚠️ Payment failed for customer ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');

// Resolve plan from Stripe price ID — evaluated at runtime, not module load
function getPlanFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_STARTER_MONTHLY]: { plan: 'starter', tokens_limit: 150000 },
    [process.env.STRIPE_PRICE_STARTER_YEARLY]: { plan: 'starter', tokens_limit: 150000 },
    [process.env.STRIPE_PRICE_PRO_MONTHLY]: { plan: 'pro', tokens_limit: 500000 },
    [process.env.STRIPE_PRICE_PRO_YEARLY]: { plan: 'pro', tokens_limit: 500000 },
    [process.env.STRIPE_PRICE_BIZ_MONTHLY]: { plan: 'business', tokens_limit: 1500000 },
    [process.env.STRIPE_PRICE_BIZ_YEARLY]: { plan: 'business', tokens_limit: 1500000 },
  };

  // Exact match
  if (priceId && map[priceId]) return map[priceId];

  // Fallback: try matching by checking env vars directly (handles key ordering issues)
  if (priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY || priceId === process.env.STRIPE_PRICE_STARTER_YEARLY) {
    return { plan: 'starter', tokens_limit: 150000 };
  }
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
    return { plan: 'pro', tokens_limit: 500000 };
  }
  if (priceId === process.env.STRIPE_PRICE_BIZ_MONTHLY || priceId === process.env.STRIPE_PRICE_BIZ_YEARLY) {
    return { plan: 'business', tokens_limit: 1500000 };
  }

  console.warn('⚠️ Unknown Stripe price ID:', priceId, '— defaulting to starter');
  return { plan: 'starter', tokens_limit: 150000 };
}

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

  console.log(`📨 Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata?.supabase_uid;

        if (!uid) {
          // Fallback: find user by stripe customer ID
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', session.customer)
            .maybeSingle();

          if (!profile) {
            console.error('❌ checkout.session.completed: No user found for session', session.id);
            break;
          }

          // Continue with found profile id
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = subscription.items.data[0]?.price.id;
          const planInfo = getPlanFromPriceId(priceId);

          await supabaseAdmin.from('profiles').update({
            plan: planInfo.plan,
            tokens_limit: planInfo.tokens_limit,
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);

          console.log(`✅ User ${profile.id} upgraded to ${planInfo.plan} (${planInfo.tokens_limit} tokens) via customer lookup`);
          break;
        }

        // Primary path: uid from metadata
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0]?.price.id;
        const planInfo = getPlanFromPriceId(priceId);

        const { error: updateErr } = await supabaseAdmin.from('profiles').update({
          plan: planInfo.plan,
          tokens_limit: planInfo.tokens_limit,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          updated_at: new Date().toISOString()
        }).eq('id', uid);

        if (updateErr) {
          console.error('❌ Profile update failed for user:', uid, updateErr);
        } else {
          console.log(`✅ User ${uid} upgraded to ${planInfo.plan} (${planInfo.tokens_limit} tokens)`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!profile) {
          console.warn('⚠️ subscription.updated: No profile for customer', customerId);
          break;
        }

        if (subscription.status === 'active') {
          const priceId = subscription.items.data[0]?.price.id;
          const planInfo = getPlanFromPriceId(priceId);
          await supabaseAdmin.from('profiles').update({
            plan: planInfo.plan,
            tokens_limit: planInfo.tokens_limit,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);
          console.log(`🔄 User ${profile.id} subscription updated to ${planInfo.plan}`);
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          console.warn(`⚠️ User ${profile.id} subscription status: ${subscription.status}`);
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
          .maybeSingle();

        if (profile) {
          await supabaseAdmin.from('profiles').update({
            plan: 'explorer',
            tokens_limit: 30000,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          }).eq('id', profile.id);
          console.log(`⬇️ User ${profile.id} downgraded to explorer (30K tokens)`);
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

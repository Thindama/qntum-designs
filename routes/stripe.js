const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

// Stripe is initialized lazily (only when keys are set)
let stripe = null;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Plan definitions
const PLANS = {
  explorer: {
    name: 'Explorer',
    price: 0,
    tokens_limit: 30000,
    projects_limit: 1,
    features: ['1 Projekt', '30K Tokens/Monat', 'Qntum-Subdomain', 'UI/UX Pro, Brand Design, Design System, Banner Skills'],
    capabilities: { custom_domain: false, code_export: false, priority: false, white_label: false, team: false, api: false }
  },
  starter: {
    name: 'Starter',
    priceMonthly: 29,
    priceYearly: 290,
    tokens_limit: 150000,
    projects_limit: 5,
    stripePriceMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    features: ['5 Projekte', '150K Tokens/Monat', 'Custom Domain', 'HTML/CSS Export', 'Frontend Design, UI Styling, UI/UX Pro, Brand Design, Design System Skills'],
    capabilities: { custom_domain: true, code_export: 'html_css', priority: false, white_label: false, team: false, api: false }
  },
  pro: {
    name: 'Pro',
    priceMonthly: 79,
    priceYearly: 790,
    tokens_limit: 500000,
    projects_limit: 25,
    stripePriceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: ['25 Projekte', '500K Tokens/Monat', 'Custom Domain + SSL', 'Vollständiger Code-Export', 'Priority Generation', 'Alle Design-Skills'],
    capabilities: { custom_domain: true, code_export: 'full', priority: true, white_label: false, team: false, api: false }
  },
  business: {
    name: 'Business',
    priceMonthly: 149,
    priceYearly: 1490,
    tokens_limit: 1500000,
    projects_limit: -1, // unlimited
    stripePriceMonthly: process.env.STRIPE_PRICE_BIZ_MONTHLY,
    stripePriceYearly: process.env.STRIPE_PRICE_BIZ_YEARLY,
    features: ['Unbegrenzte Projekte', '1.5M Tokens/Monat', 'White-Label', 'Team-Zugang (10 Mitglieder)', 'API-Zugang', 'Komplettes Skill-Paket'],
    capabilities: { custom_domain: true, code_export: 'full', priority: true, white_label: true, team: true, api: true }
  }
};

// Alias: 'free' maps to 'explorer' for backwards compatibility
PLANS.free = PLANS.explorer;

// ═══ STARTUP DIAGNOSTICS ═══
console.log('═══════════════════════════════════════════');
console.log('  Stripe Config Check (Server-Start)');
console.log('═══════════════════════════════════════════');
console.log('  STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? `✅ ${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...` : '❌ FEHLT');
console.log('');
console.log('  Env-Variablen (process.env):');
console.log('    STRIPE_PRICE_STARTER_MONTHLY:', process.env.STRIPE_PRICE_STARTER_MONTHLY || '❌ FEHLT');
console.log('    STRIPE_PRICE_STARTER_YEARLY: ', process.env.STRIPE_PRICE_STARTER_YEARLY || '❌ FEHLT');
console.log('    STRIPE_PRICE_PRO_MONTHLY:    ', process.env.STRIPE_PRICE_PRO_MONTHLY || '❌ FEHLT');
console.log('    STRIPE_PRICE_PRO_YEARLY:     ', process.env.STRIPE_PRICE_PRO_YEARLY || '❌ FEHLT');
console.log('    STRIPE_PRICE_BIZ_MONTHLY:    ', process.env.STRIPE_PRICE_BIZ_MONTHLY || '❌ FEHLT');
console.log('    STRIPE_PRICE_BIZ_YEARLY:     ', process.env.STRIPE_PRICE_BIZ_YEARLY || '❌ FEHLT');
console.log('');
console.log('  In PLANS gespeichert (diese Werte werden beim Checkout verwendet):');
console.log('    starter.stripePriceMonthly:', PLANS.starter.stripePriceMonthly || '❌ undefined');
console.log('    starter.stripePriceYearly: ', PLANS.starter.stripePriceYearly || '❌ undefined');
console.log('    pro.stripePriceMonthly:    ', PLANS.pro.stripePriceMonthly || '❌ undefined');
console.log('    pro.stripePriceYearly:     ', PLANS.pro.stripePriceYearly || '❌ undefined');
console.log('    business.stripePriceMonthly:', PLANS.business.stripePriceMonthly || '❌ undefined');
console.log('    business.stripePriceYearly: ', PLANS.business.stripePriceYearly || '❌ undefined');
console.log('═══════════════════════════════════════════');

// GET /api/stripe/plans — list available plans (public)
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// POST /api/stripe/checkout — create Stripe Checkout session
router.post('/checkout', requireAuth, async (req, res) => {
  console.log('━━━ /api/stripe/checkout HIT ━━━');
  console.log('  Body:', JSON.stringify(req.body));
  console.log('  User:', req.userId);

  const s = getStripe();
  if (!s) {
    console.error('❌ Stripe nicht initialisiert — STRIPE_SECRET_KEY fehlt oder ungültig');
    return res.status(503).json({ error: 'Zahlungen sind noch nicht konfiguriert.' });
  }

  const { plan, interval } = req.body; // plan: 'starter'|'pro'|'business', interval: 'monthly'|'yearly'
  const planDef = PLANS[plan];

  if (!planDef || plan === 'free' || plan === 'explorer') {
    return res.status(400).json({ error: `Ungültiger Plan: "${plan}". Erlaubt: starter, pro, business` });
  }

  const priceId = interval === 'yearly' ? planDef.stripePriceYearly : planDef.stripePriceMonthly;
  const priceEnvKey = `STRIPE_PRICE_${plan === 'business' ? 'BIZ' : plan.toUpperCase()}_${(interval || 'monthly').toUpperCase()}`;

  if (!priceId) {
    console.error(`❌ Stripe Price ID fehlt! Plan: ${plan}, Interval: ${interval}, Env-Variable: ${priceEnvKey}`);
    return res.status(400).json({
      error: `Preis nicht konfiguriert. Env-Variable ${priceEnvKey} ist nicht gesetzt.`
    });
  }

  console.log(`💳 Checkout: plan=${plan}, interval=${interval}, priceId=${priceId}`);

  try {
    // Get or create Stripe customer
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', req.userId)
      .single();

    if (profileErr || !profile) {
      console.error('❌ Profil nicht gefunden:', profileErr?.message, 'userId:', req.userId);
      return res.status(400).json({ error: 'Benutzerprofil nicht gefunden.' });
    }

    console.log(`👤 Profile: email=${profile.email}, stripe_customer_id=${profile.stripe_customer_id || 'noch keiner'}`);

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await s.customers.create({
        email: profile.email || undefined,
        metadata: { supabase_uid: req.userId }
      });
      customerId = customer.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', req.userId);
      console.log(`✅ Stripe Customer erstellt: ${customerId}`);
    }

    // Use https for production (Railway proxy terminates TLS)
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${req.get('host')}`
      : `${req.protocol}://${req.get('host')}`;

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard.html?payment=success&plan=${plan}`,
      cancel_url: `${baseUrl}/checkout.html?payment=cancelled`,
      metadata: { supabase_uid: req.userId, plan },
      subscription_data: {
        metadata: { supabase_uid: req.userId, plan }
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe Checkout Error:');
    console.error('  Type:', err.type);
    console.error('  Code:', err.code);
    console.error('  Message:', err.message);
    console.error('  Param:', err.param);
    console.error('  StatusCode:', err.statusCode);
    if (err.raw) console.error('  Raw:', JSON.stringify(err.raw, null, 2));

    const clientMsg = err.type === 'StripeInvalidRequestError'
      ? `Stripe-Fehler: ${err.message}`
      : 'Checkout konnte nicht erstellt werden. Siehe Server-Logs.';
    res.status(500).json({ error: clientMsg });
  }
});

// POST /api/stripe/portal — create billing portal session
router.post('/portal', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Zahlungen sind noch nicht konfiguriert.' });

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'Kein aktives Abonnement' });
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? `https://${req.get('host')}`
      : `${req.protocol}://${req.get('host')}`;

    const session = await s.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/dashboard.html`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: 'Billing-Portal konnte nicht geöffnet werden' });
  }
});

// GET /api/stripe/subscription — get current subscription status
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan, tokens_used, tokens_limit, stripe_customer_id')
      .eq('id', req.userId)
      .single();

    res.json({
      plan: profile.plan || 'explorer',
      tokens_used: profile.tokens_used || 0,
      tokens_limit: profile.tokens_limit || PLANS.explorer.tokens_limit,
      features: PLANS[profile.plan || 'explorer']?.features || PLANS.explorer.features
    });
  } catch (err) {
    res.status(500).json({ error: 'Abo-Status konnte nicht geladen werden' });
  }
});

// POST /api/stripe/verify — verify and sync subscription after payment redirect
// Called by frontend after successful checkout to ensure profile is up-to-date
router.post('/verify', requireAuth, async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Stripe nicht konfiguriert' });

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, plan, tokens_limit')
      .eq('id', req.userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.json({ plan: profile?.plan || 'explorer', tokens_limit: profile?.tokens_limit || 30000, synced: false });
    }

    // Fetch active subscriptions from Stripe
    const subscriptions = await s.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      // No active subscription — ensure profile reflects free
      if (profile.plan !== 'explorer') {
        await supabaseAdmin.from('profiles').update({
          plan: 'explorer', tokens_limit: 30000, updated_at: new Date().toISOString()
        }).eq('id', req.userId);
      }
      return res.json({ plan: 'explorer', tokens_limit: 30000, synced: true });
    }

    // Active subscription found — derive plan from price
    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price.id;

    let plan = 'starter';
    let tokens_limit = 150000;
    if (priceId === process.env.STRIPE_PRICE_BIZ_MONTHLY || priceId === process.env.STRIPE_PRICE_BIZ_YEARLY) {
      plan = 'business';
      tokens_limit = 1500000;
    } else if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) {
      plan = 'pro';
      tokens_limit = 500000;
    } else if (priceId === process.env.STRIPE_PRICE_STARTER_MONTHLY || priceId === process.env.STRIPE_PRICE_STARTER_YEARLY) {
      plan = 'starter';
      tokens_limit = 150000;
    }

    // Update profile if out of sync
    if (profile.plan !== plan || profile.tokens_limit !== tokens_limit) {
      await supabaseAdmin.from('profiles').update({
        plan,
        tokens_limit,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString()
      }).eq('id', req.userId);
      console.log(`🔄 Verified & synced user ${req.userId}: ${plan} (${tokens_limit} tokens)`);
    }

    return res.json({ plan, tokens_limit, synced: true });
  } catch (err) {
    console.error('Stripe verify error:', err);
    res.status(500).json({ error: 'Verifizierung fehlgeschlagen' });
  }
});

module.exports = router;
module.exports.PLANS = PLANS;

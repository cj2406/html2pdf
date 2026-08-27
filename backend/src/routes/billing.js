const express = require('express');
const prisma = require('../db/prisma');
const authJwt = require('../middleware/authJwt');
const verifyCsrf = require('../middleware/csrf');
const { listPlans, getPlan } = require('../services/plans');
const { getProvider, listProviders } = require('../services/payments');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/plans', (_req, res) => {
  res.json({ plans: listPlans(), providers: listProviders() });
});

/**
 * POST /api/billing/subscribe
 * Body: { planId: "pro", provider?: "paystack" }
 * Starts a checkout session and returns the URL to redirect the user to.
 */
router.post('/subscribe', authJwt, verifyCsrf, asyncHandler(async (req, res) => {
  const { planId, provider: providerName } = req.body || {};

  let plan;
  try {
    plan = getPlan(planId);
  } catch {
    return res.status(400).json({ error: `Unknown plan "${planId}"` });
  }

  if (plan.id === 'free') {
    await prisma.subscription.create({
      data: { userId: req.userId, planId: 'free', status: 'active', provider: 'none' },
    });
    return res.json({ message: 'Switched to Free plan', authorizationUrl: null });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(401).json({ error: 'Account not found' });
    const provider = getProvider(providerName);

    const { authorizationUrl, reference } = await provider.initializeTransaction({
      email: user.email,
      amountInMinorUnits: plan.amount,
      currency: plan.currency,
      planId: plan.id,
      callbackUrl: `${process.env.FRONTEND_URL}/billing/callback`,
      metadata: { userId: user.id },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        provider: provider.name,
        reference,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        status: 'pending',
      },
    });

    res.json({ authorizationUrl, reference });
  } catch (err) {
    console.error('[billing/subscribe] error:', err.message);
    if (err.response?.status === 429) {
      const retryAfter = err.response.headers?.['retry-after'];
      if (retryAfter) res.set('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Payment provider is temporarily rate limiting checkout. Please try again shortly.' });
    }
    if (err.response?.status === 400) {
      const providerMessage = err.response.data?.message;
      console.error('[billing/subscribe] provider response:', err.response.data);
      return res.status(400).json({ error: providerMessage || 'Payment provider rejected the checkout request' });
    }
    res.status(502).json({ error: 'Could not start checkout' });
  }
}));

/**
 * GET /api/billing/verify/:reference?provider=paystack
 * Called by the frontend after the user is redirected back from checkout.
 *
 * Note: this is a state-mutating GET, which is unusual — it exists this way
 * because Paystack redirects the browser here directly, and a redirect
 * can't carry a custom CSRF header. The blast radius is limited (at worst,
 * a crafted reference just re-confirms an already-successful transaction),
 * and this endpoint is NOT the source of truth for billing state — the
 * signed webhook in routes/webhooks.js is. This endpoint only gives the
 * user immediate feedback in the UI.
 */
router.get('/verify/:reference', authJwt, asyncHandler(async (req, res) => {
  const { reference } = req.params;
  const providerName = req.query.provider;

  try {
    const provider = getProvider(providerName);
    const payment = await prisma.payment.findFirst({
      where: { reference, userId: req.userId },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const result = await provider.verifyTransaction(reference);
    if (result.planId !== payment.planId || result.amount !== payment.amount || result.currency !== payment.currency) {
      return res.status(409).json({ error: 'Payment details do not match the selected plan' });
    }

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: 'pending' },
      data: { status: result.status },
    });

    if (updated.count === 1 && result.status === 'success') {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      await prisma.subscription.create({
        data: {
          userId: req.userId,
          planId: result.planId,
          status: 'active',
          provider: provider.name,
          currentPeriodEnd,
        },
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[billing/verify] error:', err.message);
    res.status(502).json({ error: 'Could not verify payment' });
  }
}));

router.get('/history', authJwt, asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ payments });
}));

module.exports = router;

const express = require('express');
const prisma = require('../db/prisma');
const { getProvider } = require('../services/payments');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * POST /api/webhooks/:provider  e.g. /api/webhooks/paystack
 * IMPORTANT: this route must receive the raw request body (see server.js,
 * where express.raw() is applied specifically to this path) so the
 * signature can be verified against the exact bytes the provider sent.
 */
router.post('/:provider', asyncHandler(async (req, res) => {
  const providerName = req.params.provider;
  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return res.status(404).json({ error: 'Unknown provider' });
  }

  const rawBody = req.body; // Buffer, thanks to express.raw() in server.js
  const isValid = provider.verifyWebhookSignature(rawBody, req.headers);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed JSON' });
  }

  const event = provider.parseWebhookEvent(payload);

  try {
    await handleEvent(event, provider.name);
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    // Still 200 — the provider retries on non-2xx, and we don't want dupes for a local bug.
  }

  res.sendStatus(200);
}));

async function handleEvent(event, providerName) {
  if (event.type === 'charge.success' && event.reference) {
    const payment = await prisma.payment.update({
      where: { reference: event.reference },
      data: { status: 'success' },
    }).catch(() => null);

    if (payment) {
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      await prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          status: 'active',
          provider: providerName,
          currentPeriodEnd,
        },
      });
    }
  }

  if (event.type === 'subscription.cancelled' && event.customerEmail) {
    const user = await prisma.user.findUnique({ where: { email: event.customerEmail } });
    if (user) {
      await prisma.subscription.updateMany({
        where: { userId: user.id, status: 'active' },
        data: { status: 'cancelled' },
      });
    }
  }

  if (event.type === 'invoice.payment_failed' && event.customerEmail) {
    const user = await prisma.user.findUnique({ where: { email: event.customerEmail } });
    if (user) {
      await prisma.subscription.updateMany({
        where: { userId: user.id, status: 'active' },
        data: { status: 'past_due' },
      });
    }
  }
}

module.exports = router;

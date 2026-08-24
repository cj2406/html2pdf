const prisma = require('../db/prisma');
const { getPlan } = require('../services/plans');
const asyncHandler = require('../utils/asyncHandler');

function currentPeriodMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

/**
 * 1. Resolves the API key -> user + active subscription plan.
 * 2. Enforces the plan's monthly conversion quota.
 * 3. Attaches req.billing = { userId, plan, apiKeyId, usedThisMonth } for downstream use.
 * Does NOT increment usage — that happens after a successful conversion
 * (see routes/convert.js) so failed conversions aren't billed.
 */
async function authApiKeyImpl(req, res, next) {
  const key = req.headers['x-api-key'] || (req.query && req.query.api_key);

  if (!key) {
    return res.status(401).json({ error: 'Missing API key. Send it in the X-API-Key header.' });
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    include: { user: true },
  });

  if (!apiKey || !apiKey.active) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  const sub = await prisma.subscription.findFirst({
    where: { userId: apiKey.userId },
    orderBy: { id: 'desc' },
  });

  const planId = sub && sub.status === 'active' ? sub.planId : 'free';
  const plan = getPlan(planId);

  const month = currentPeriodMonth();
  const usage = await prisma.usageLog.findUnique({
    where: { userId_periodMonth: { userId: apiKey.userId, periodMonth: month } },
  });
  const usedThisMonth = usage ? usage.count : 0;

  if (usedThisMonth >= plan.monthlyConversions) {
    return res.status(429).json({
      error: 'Monthly conversion quota exceeded for your plan',
      plan: plan.id,
      limit: plan.monthlyConversions,
      used: usedThisMonth,
      upgrade: '/pricing',
    });
  }

  req.billing = {
    userId: apiKey.userId,
    email: apiKey.user.email,
    apiKeyId: apiKey.id,
    plan,
    usedThisMonth,
  };

  next();
}

async function recordUsage(userId, apiKeyId) {
  const periodMonth = currentPeriodMonth();
  await prisma.usageLog.upsert({
    where: { userId_periodMonth: { userId, periodMonth } },
    update: { count: { increment: 1 }, apiKeyId },
    create: { userId, apiKeyId, periodMonth, count: 1 },
  });
}

// Wrapped so a database hiccup here (e.g. Postgres unreachable) returns a
// 500 instead of crashing the process — see utils/asyncHandler.js.
const authApiKey = asyncHandler(authApiKeyImpl);

module.exports = { authApiKey, recordUsage, currentPeriodMonth };

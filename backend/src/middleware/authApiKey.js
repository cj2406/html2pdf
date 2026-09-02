const prisma = require('../db/prisma');
const { getPlan } = require('../services/plans');
const { isSubscriptionActive } = require('../services/subscriptions');
const asyncHandler = require('../utils/asyncHandler');

//TODO
//what is release and reserve usage,
//learn tailwind
//what to do bout cancel sub when theres no button
//type of rate-limiter
//sliding-window??
//learn bucket4j
//check school files
/*whats the return value of 
 public boolean tryConsume(UUID apiKeyId, Plan plan) {
        Bucket bucket = buckets.computeIfAbsent(apiKeyId, id -> newBucket(plan.getMaxRequestsPerMinute()));
        return bucket.tryConsume(1);
    }
         */
// whats  @org.springframework.web.bind.annotation.RequestHeader(value = "x-paystack-signature", required = false)

function currentPeriodMonth() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

/**
 * 1. Resolves the API key -> user + active subscription plan.
 * 2. Enforces the plan's monthly conversion quota.
 * 3. Attaches req.billing = { userId, plan, apiKeyId, usedThisMonth } for downstream use.
 * The conversion route reserves quota atomically before rendering and releases
 * it if rendering fails, so concurrent requests cannot overspend the quota.
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

  const isActive = isSubscriptionActive(sub);
  const planId = isActive ? sub.planId : 'free';
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

async function reserveUsage(userId, apiKeyId, monthlyLimit) {
  const periodMonth = currentPeriodMonth();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "usage_logs" ("user_id", "api_key_id", "period_month", "count")
      VALUES (${userId}, ${apiKeyId}, ${periodMonth}, 0)
      ON CONFLICT ("user_id", "period_month") DO NOTHING
    `;
    return tx.$executeRaw`
      UPDATE "usage_logs"
      SET "count" = "count" + 1, "api_key_id" = ${apiKeyId}
      WHERE "user_id" = ${userId}
        AND "period_month" = ${periodMonth}
        AND "count" < ${monthlyLimit}
    `;
  });

  if (updated !== 1) {
    const error = new Error('Monthly conversion quota exceeded for your plan');
    error.code = 'QUOTA_EXCEEDED';
    throw error;
  }
}

async function releaseUsage(userId) {
  const periodMonth = currentPeriodMonth();
  await prisma.usageLog.updateMany({
    where: { userId, periodMonth, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}

// Wrapped so a database hiccup here (e.g. Postgres unreachable) returns a
// 500 instead of crashing the process — see utils/asyncHandler.js.
const authApiKey = asyncHandler(authApiKeyImpl);

module.exports = { authApiKey, reserveUsage, releaseUsage, currentPeriodMonth };

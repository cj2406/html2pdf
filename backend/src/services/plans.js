/**
 * Subscription plans.
 * amount is in the smallest currency unit (kobo for NGN) since that's what
 * Paystack expects. 100 kobo = 1 NGN.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    amount: 0,
    currency: 'NGN',
    monthlyConversions: 50,
    maxFileSizeMb: 2,
    watermark: true,
    concurrentRequests: 1,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    amount: 500000, // 5,000 NGN
    currency: 'NGN',
    monthlyConversions: 2000,
    maxFileSizeMb: 10,
    watermark: false,
    concurrentRequests: 3,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    amount: 1500000, // 15,000 NGN
    currency: 'NGN',
    monthlyConversions: 15000,
    maxFileSizeMb: 25,
    watermark: false,
    concurrentRequests: 10,
  },
  business: {
    id: 'business',
    name: 'Business',
    amount: 5000000, // 50,000 NGN
    currency: 'NGN',
    monthlyConversions: 100000,
    maxFileSizeMb: 50,
    watermark: false,
    concurrentRequests: 30,
  },
};

function getPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Unknown plan "${planId}"`);
  return plan;
}

function listPlans() {
  return Object.values(PLANS);
}

module.exports = { PLANS, getPlan, listPlans };

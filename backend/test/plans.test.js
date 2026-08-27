const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PLANS, getPlan, listPlans } = require('../src/services/plans');

test('all plans expose the billing fields used by the API', () => {
  const plans = listPlans();

  assert.deepEqual(plans.map((plan) => plan.id), ['free', 'starter', 'pro', 'business']);
  for (const plan of plans) {
    assert.equal(plan.currency, 'NGN');
    assert.equal(typeof plan.amount, 'number');
    assert.equal(typeof plan.monthlyConversions, 'number');
    assert.equal(typeof plan.maxFileSizeMb, 'number');
    assert.equal(typeof plan.watermark, 'boolean');
    assert.equal(typeof plan.concurrentRequests, 'number');
  }
});

test('getPlan returns the requested plan', () => {
  assert.strictEqual(getPlan('pro'), PLANS.pro);
  assert.equal(getPlan('free').monthlyConversions, 50);
  assert.equal(getPlan('business').concurrentRequests, 30);
});

test('getPlan rejects unknown plans', () => {
  assert.throws(
    () => getPlan('not-a-plan'),
    { message: 'Unknown plan "not-a-plan"' },
  );
});
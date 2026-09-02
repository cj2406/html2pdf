const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { test } = require('node:test');
const { assertPublicUrl } = require('../src/services/pdfService');
const authJwt = require('../src/middleware/authJwt');
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

test('assertPublicUrl rejects private addresses', async () => {
  await assert.rejects(
    () => assertPublicUrl('http://127.0.0.1'),
    /private|local|invalid/i,
  );
});

test('authJwt rejects non-HS256 tokens', () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = jwt.sign({ userId: 'abc123' }, process.env.JWT_SECRET, { algorithm: 'none' });

  const req = { cookies: { h2p_session: token } };
  const res = {
    status(code) {
      assert.equal(code, 401);
      return { json() {} };
    },
  };

  let calledNext = false;
  authJwt(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
});
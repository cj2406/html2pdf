const crypto = require('crypto');
const axios = require('axios');
const PaymentProvider = require('./PaymentProvider');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

class PaystackProvider extends PaymentProvider {
  constructor() {
    super();
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!this.secretKey) {
      // Don't throw at import time in dev — but every real call will fail loudly.
      console.warn('[PaystackProvider] PAYSTACK_SECRET_KEY is not set.');
    }
    this.client = axios.create({
      baseURL: PAYSTACK_BASE_URL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  get name() {
    return 'paystack';
  }

  async initializeTransaction({ email, amountInMinorUnits, currency = 'NGN', planId, callbackUrl, metadata = {} }) {
    const { data } = await this.client.post('/transaction/initialize', {
      email,
      amount: amountInMinorUnits, // Paystack expects the amount in kobo for NGN
      currency,
      callback_url: callbackUrl,
      metadata: { ...metadata, planId },
    });

    if (!data.status) {
      throw new Error(`Paystack initialize failed: ${data.message}`);
    }

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  }

  async verifyTransaction(reference) {
    const { data } = await this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`);

    if (!data.status) {
      throw new Error(`Paystack verify failed: ${data.message}`);
    }

    const tx = data.data;
    return {
      status: tx.status === 'success' ? 'success' : tx.status === 'abandoned' ? 'failed' : 'pending',
      amount: tx.amount,
      currency: tx.currency,
      customerEmail: tx.customer && tx.customer.email,
      planId: tx.metadata && tx.metadata.planId ? tx.metadata.planId : null,
      metadata: tx.metadata || {},
    };
  }

  verifyWebhookSignature(rawBody, headers) {
    if (!this.secretKey) return false;
    const signature = headers['x-paystack-signature'];
    if (!signature) return false;
    const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const expected = Buffer.from(hash, 'hex');
    const received = Buffer.from(signature, 'hex');
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  }

  parseWebhookEvent(payload) {
    const event = payload.event;
    const d = payload.data || {};

    if (event === 'charge.success') {
      return {
        type: 'charge.success',
        reference: d.reference || null,
        customerEmail: d.customer && d.customer.email,
        planId: d.metadata && d.metadata.planId ? d.metadata.planId : null,
        amount: d.amount || null,
        raw: payload,
      };
    }

    if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      return {
        type: 'subscription.cancelled',
        reference: null,
        customerEmail: d.customer && d.customer.email,
        planId: d.plan && d.plan.plan_code ? d.plan.plan_code : null,
        amount: null,
        raw: payload,
      };
    }

    if (event === 'invoice.payment_failed') {
      return {
        type: 'invoice.payment_failed',
        reference: null,
        customerEmail: d.customer && d.customer.email,
        planId: null,
        amount: null,
        raw: payload,
      };
    }

    return { type: 'unknown', reference: null, customerEmail: null, planId: null, amount: null, raw: payload };
  }

  async cancelSubscription(providerSubscriptionId) {
    // Paystack requires the subscription code + email token to disable a subscription.
    // providerSubscriptionId is expected to be "code:token".
    const [code, token] = String(providerSubscriptionId).split(':');
    const { data } = await this.client.post('/subscription/disable', {
      code,
      token,
    });
    return data.status === true;
  }
}

module.exports = PaystackProvider;

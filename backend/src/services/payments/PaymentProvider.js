/**
 * PaymentProvider
 * ----------------
 * Abstract interface every payment provider (Paystack, Stripe, Flutterwave, ...)
 * must implement. The rest of the app (routes/billing.js, routes/webhooks.js)
 * only ever talks to this interface, never to a provider's SDK directly.
 *
 * To add a new provider:
 *   1. Create services/payments/<Name>Provider.js extending this class.
 *   2. Implement every method below.
 *   3. Register it in services/payments/index.js's PROVIDERS map.
 *   4. Add its keys to .env.
 * Nothing else in the codebase needs to change.
 */
class PaymentProvider {
  /** Unique slug used in the DB / API, e.g. "paystack" */
  get name() {
    throw new Error('PaymentProvider.name must be implemented');
  }

  /**
   * Start a checkout for a subscription plan.
   * @param {Object} params
   * @param {string} params.email - customer email
   * @param {number} params.amountInMinorUnits - e.g. kobo for NGN, cents for USD
   * @param {string} params.currency - e.g. "NGN"
   * @param {string} params.planId - internal plan id (see services/plans.js)
   * @param {string} params.callbackUrl - where the provider redirects after checkout
   * @param {Object} params.metadata - arbitrary data echoed back on verification/webhook
   * @returns {Promise<{ authorizationUrl: string, reference: string }>}
   */
  async initializeTransaction(_params) {
    throw new Error('initializeTransaction() not implemented');
  }

  /**
   * Verify a transaction by reference (used after redirect back from checkout).
   * @param {string} _reference
   * @returns {Promise<{ status: 'success'|'failed'|'pending', amount: number,
   *   currency: string, customerEmail: string, planId: string|null, metadata: Object }>}
   */
  async verifyTransaction(_reference) {
    throw new Error('verifyTransaction() not implemented');
  }

  /**
   * Verify that an incoming webhook request really came from the provider.
   * @param {Buffer|string} _rawBody - raw request body
   * @param {Object} _headers - request headers
   * @returns {boolean}
   */
  verifyWebhookSignature(_rawBody, _headers) {
    throw new Error('verifyWebhookSignature() not implemented');
  }

  /**
   * Normalize a provider-specific webhook payload into a common shape the
   * rest of the app understands.
   * @param {Object} _payload - parsed JSON body
   * @returns {{ type: 'charge.success'|'subscription.cancelled'|'invoice.payment_failed'|'unknown',
   *   reference: string|null, customerEmail: string|null, planId: string|null,
   *   amount: number|null, raw: Object }}
   */
  parseWebhookEvent(_payload) {
    throw new Error('parseWebhookEvent() not implemented');
  }

  /**
   * Cancel a recurring subscription on the provider's side.
   * @param {string} _providerSubscriptionId
   */
  async cancelSubscription(_providerSubscriptionId) {
    throw new Error('cancelSubscription() not implemented');
  }
}

module.exports = PaymentProvider;

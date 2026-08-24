const PaystackProvider = require('./PaystackProvider');

/**
 * Registry of available payment providers.
 * Add a new entry here (and only here + the provider file itself) to support
 * another payment processor, e.g.:
 *   const StripeProvider = require('./StripeProvider');
 *   PROVIDERS.stripe = () => new StripeProvider();
 */
const PROVIDERS = {
  paystack: () => new PaystackProvider(),
};

const instances = {};

/**
 * Get a (cached) payment provider instance by name.
 * @param {string} name - e.g. "paystack"
 * @returns {import('./PaymentProvider')}
 */
function getProvider(name) {
  const key = (name || process.env.DEFAULT_PAYMENT_PROVIDER || 'paystack').toLowerCase();
  if (!PROVIDERS[key]) {
    throw new Error(`Unknown payment provider "${key}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  if (!instances[key]) {
    instances[key] = PROVIDERS[key]();
  }
  return instances[key];
}

function listProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { getProvider, listProviders };

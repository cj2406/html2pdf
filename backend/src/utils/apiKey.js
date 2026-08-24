const crypto = require('crypto');

/** Generates a key like h2p_live_9f3a1b... */
function generateApiKey() {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const random = crypto.randomBytes(24).toString('hex');
  return `h2p_${env}_${random}`;
}

module.exports = { generateApiKey };

const crypto = require('crypto');

function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Cookie options shared by the session (httpOnly) and CSRF (readable) cookies.
 *
 * SameSite/Secure notes:
 * - In production, the frontend and backend often live on different domains,
 *   which makes requests between them "cross-site" from the cookie's point
 *   of view. Cross-site cookies require SameSite=None, and browsers require
 *   Secure (HTTPS) for any SameSite=None cookie — so both are tied to
 *   NODE_ENV=production here.
 * - In local dev (e.g. localhost:8080 talking to localhost:4000), both
 *   origins share the registrable domain "localhost", so they're same-site
 *   even though they're different origins/ports — SameSite=Lax works fine
 *   there without HTTPS.
 */
function baseCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, 
    path: '/',
  };
}

function sessionCookieOptions() {
  return { ...baseCookieOptions(), httpOnly: true };
}

function csrfCookieOptions() {
  return { ...baseCookieOptions(), httpOnly: false }; // must be readable by frontend JS
}

module.exports = { generateCsrfToken, sessionCookieOptions, csrfCookieOptions };

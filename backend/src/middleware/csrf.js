const CSRF_COOKIE = 'h2p_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie CSRF check.
 *
 * On login/signup we set a random token in a non-httpOnly cookie
 * (h2p_csrf). The frontend reads that cookie's value and sends it back as
 * the X-CSRF-Token header on every state-changing request. A malicious
 * third-party site can make the browser *send* our cookies automatically,
 * but it cannot *read* them (same-origin policy) — so it can't produce a
 * header that matches, and the request is rejected.
 *
 * Apply this AFTER authJwt on any route that mutates state (POST/PUT/DELETE)
 * for a browser session. Not needed for GET/HEAD (safe methods) or for the
 * API-key-authenticated /api/v1/* routes, which aren't cookie-based at all.
 */
function verifyCsrf(req, res, next) {
  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF check failed. Refresh and try again.' });
  }

  next();
}

module.exports = verifyCsrf;
module.exports.CSRF_COOKIE = CSRF_COOKIE;
module.exports.CSRF_HEADER = CSRF_HEADER;

const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'h2p_session';

/**
 * Reads the JWT from the httpOnly session cookie (set on login/signup — see
 * routes/auth.js). The token never touches localStorage or JS on the
 * frontend, so it isn't readable by an XSS payload.
 */
function authJwt(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid, please log in again' });
  }
}

module.exports = authJwt;
module.exports.SESSION_COOKIE = SESSION_COOKIE;

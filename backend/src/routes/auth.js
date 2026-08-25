const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');
const { generateApiKey } = require('../utils/apiKey');
const { generateCsrfToken, sessionCookieOptions, csrfCookieOptions } = require('../utils/csrf');
const authJwt = require('../middleware/authJwt');
const verifyCsrf = require('../middleware/csrf');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const SESSION_COOKIE = authJwt.SESSION_COOKIE;
const CSRF_COOKIE = verifyCsrf.CSRF_COOKIE;
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Issues a fresh session: sets the httpOnly JWT cookie + the readable CSRF cookie. */
function startSession(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const csrfToken = generateCsrfToken();

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
}

router.post('/signup', authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';
  if (!EMAIL_PATTERN.test(email) || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and password (8+ chars) are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      subscriptions: { create: { planId: 'free', status: 'active', provider: 'none' } },
      apiKeys: { create: { key: generateApiKey(), label: 'default' } },
    },
  });

  startSession(res, user.id);
  res.status(201).json({ email: user.email });
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  startSession(res, user.id);
  res.json({ email: user.email });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
  res.json({ message: 'Logged out' });
});

router.get('/me', authJwt, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, createdAt: true },
  });

  const subscription = await prisma.subscription.findFirst({
    where: { userId: req.userId },
    orderBy: { id: 'desc' },
  });

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: req.userId },
    select: { id: true, key: true, label: true, active: true, createdAt: true },
  });

  res.json({ user, subscription, apiKeys });
}));

router.post('/api-keys/rotate', authJwt, verifyCsrf, asyncHandler(async (req, res) => {
  await prisma.apiKey.updateMany({ where: { userId: req.userId }, data: { active: false } });
  const newKey = generateApiKey();
  await prisma.apiKey.create({ data: { userId: req.userId, key: newKey, label: 'default' } });
  res.json({ apiKey: newKey });
}));

module.exports = router;

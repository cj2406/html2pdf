require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const convertRoutes = require('./routes/convert');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhooks');
const { closeBrowser } = require('./services/pdfService');

const app = express();

// credentials: true + an explicit origin (never "*") are both required for
// the browser to send/accept our httpOnly session cookie cross-origin.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  })
);

app.use(cookieParser());

// Webhooks need the RAW body for signature verification, so this must be
// registered BEFORE the global express.json() body parser below.
app.use('/api/webhooks', express.raw({ type: '*/*', limit: '2mb' }));

app.use(express.json({ limit: '15mb' }));

// Basic abuse protection on top of the per-plan quota enforced in authApiKey.
const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', globalLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/v1', convertRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use((err, _req, res, _next) => {
  console.error(err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

// Defense in depth: every async route handler is wrapped in asyncHandler
// (see utils/asyncHandler.js), so this should rarely fire — but if some
// future code forgets to wrap a handler, this stops it from taking the
// whole process down. Modern Node crashes on an unhandled rejection by
// default; log-and-continue is almost always better for a running server
// than a silent crash-restart loop.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] This should have been caught by asyncHandler — check the stack below:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`html2pdf backend listening on :${PORT}`);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  server.close(() => process.exit(0));
});

module.exports = app;

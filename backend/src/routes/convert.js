const express = require('express');
const { authApiKey, reserveUsage, releaseUsage } = require('../middleware/authApiKey');
const { convertHtmlToPdf } = require('../services/pdfService');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

/**
 * POST /api/v1/convert
 * Headers: X-API-Key: <your key>
 * Body (JSON):
 * {
 *   "html": "<h1>Hello</h1>",     // or "url": "https://example.com"
 *   "format": "A4",               // A4 | A3 | A5 | Letter | Legal | Tabloid
 *   "landscape": false,
 *   "printBackground": true,
 *   "margin": { "top": "1cm", "right": "1cm", "bottom": "1cm", "left": "1cm" }
 * }
 * Returns: application/pdf binary
 */
router.post('/convert', authApiKey, async (req, res) => {
  const { html, url, format, landscape, printBackground, margin } = req.body || {};

  if (!html && !url) {
    return res.status(400).json({ error: 'Request body must include "html" or "url"' });
  }

  const { plan, userId, apiKeyId } = req.billing;

  if (html && Buffer.byteLength(html, 'utf8') > plan.maxFileSizeMb * 1024 * 1024) {
    return res.status(413).json({ error: `HTML payload exceeds the ${plan.maxFileSizeMb}MB limit for the ${plan.name} plan` });
  }

  let usageReserved = false;
  try {
    await reserveUsage(userId, apiKeyId, plan.monthlyConversions);
    usageReserved = true;

    const pdfBuffer = await convertHtmlToPdf({
      html,
      url,
      format,
      landscape,
      printBackground,
      margin,
      watermark: plan.watermark,
      concurrencyKey: String(userId),
      concurrencyLimit: plan.concurrentRequests,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="converted.pdf"',
      'X-Plan': plan.id,
      'X-Quota-Remaining': String(plan.monthlyConversions - req.billing.usedThisMonth - 1),
    });
    res.send(pdfBuffer);
  } catch (err) {
    if (usageReserved) await releaseUsage(userId);
    console.error('[convert] error:', err.message);
    if (err.code === 'RENDER_CAPACITY' || err.code === 'QUOTA_EXCEEDED') {
      return res.status(429).json({ error: err.message });
    }
    res.status(422).json({ error: 'Conversion failed' });
  }
});

/**
 * GET /api/v1/usage — quick usage check for the authenticated API key.
 */
router.get('/usage', authApiKey, asyncHandler(async (req, res) => {
  const { plan, usedThisMonth } = req.billing;
  res.json({
    plan: plan.id,
    limit: plan.monthlyConversions,
    used: usedThisMonth,
    remaining: Math.max(plan.monthlyConversions - usedThisMonth, 0),
  });
}));

module.exports = router;

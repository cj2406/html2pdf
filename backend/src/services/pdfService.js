const puppeteer = require('puppeteer-core');
const dns = require('dns').promises;
const net = require('net');

let browserPromise = null;
const activeRenders = new Map();

/**
 * Reuse a single headless Chromium instance across requests (much faster than
 * launching per-request). Uses puppeteer-core, which does NOT bundle its own
 * Chromium download — it drives whatever browser binary you point it at via
 * PUPPETEER_EXECUTABLE_PATH. The provided Dockerfile installs Chromium via
 * apt and sets that env var for you, so in Docker this just works.
 * For local (non-Docker) dev, install a Chromium/Chrome on your machine and
 * set PUPPETEER_EXECUTABLE_PATH in your .env to its path.
 */
function getBrowser() {
  if (!browserPromise) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new Error(
        'PUPPETEER_EXECUTABLE_PATH is not set. Point it at a Chromium/Chrome binary '
      );
    }
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    browserPromise.catch(() => {
      browserPromise = null; // allow retry on next call if launch failed
    });
  }
  return browserPromise;
}

const ALLOWED_FORMATS = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'];

/**
 * Convert an HTML string (or a URL) into a PDF buffer.
 * @param {Object} opts
 * @param {string} [opts.html] - raw HTML to render. Provide this OR opts.url.
 * @param {string} [opts.url] - a URL to load and render instead of raw HTML.
 * @param {string} [opts.format='A4']
 * @param {boolean} [opts.landscape=false]
 * @param {boolean} [opts.printBackground=true]
 * @param {Object} [opts.margin] - {top,right,bottom,left} css strings e.g. "1cm"
 * @param {boolean} [opts.watermark=false] - stamp a "Made with ..." watermark (free plan)
 * @param {number} [opts.timeoutMs=30000]
 * @returns {Promise<Buffer>}
 */
async function convertHtmlToPdf(opts) {
  const {
    html,
    url,
    format = 'A4',
    landscape = false,
    printBackground = true,
    margin = { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    watermark = false,
    timeoutMs = 30000,
    concurrencyKey = null,
    concurrencyLimit = Infinity,
  } = opts;

  if (!html && !url) {
    throw new Error('Either "html" or "url" is required');
  }
  if (!ALLOWED_FORMATS.includes(format)) {
    throw new Error(`Invalid format "${format}". Allowed: ${ALLOWED_FORMATS.join(', ')}`);
  }

  const releaseSlot = acquireRenderSlot(concurrencyKey, concurrencyLimit);
  let page;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);

    if (url) {
      await assertPublicUrl(url);
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        try {
          if (request.url().startsWith('http://') || request.url().startsWith('https://')) {
            await assertPublicUrl(request.url());
          }
          await request.continue();
        } catch {
          await request.abort('blockedbyclient');
        }
      });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: timeoutMs });
    } else {
      let finalHtml = html;
      if (watermark) {
        finalHtml = injectWatermark(finalHtml);
      }
      await page.setContent(finalHtml, { waitUntil: 'networkidle0', timeout: timeoutMs });
    }

    const pdfData = await page.pdf({
      format,
      landscape,
      printBackground,
      margin,
    });

    // Puppeteer returns a Uint8Array in some versions; normalize it so Express
    // sends binary PDF bytes instead of JSON-serializing the typed array.
    return Buffer.from(pdfData);
  } finally {
    if (page) await page.close();
    releaseSlot();
  }
}

function acquireRenderSlot(key, limit) {
  if (!key || !Number.isFinite(limit)) return () => {};
  const active = activeRenders.get(key) || 0;
  if (active >= limit) {
    const error = new Error('Concurrent conversion limit reached for this plan');
    error.code = 'RENDER_CAPACITY';
    throw error;
  }
  activeRenders.set(key, active + 1);
  return () => {
    const remaining = (activeRenders.get(key) || 1) - 1;
    if (remaining > 0) activeRenders.set(key, remaining);
    else activeRenders.delete(key);
  };
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Only public HTTP(S) URLs are allowed');
  }

  const addresses = net.isIP(parsed.hostname)
    ? [parsed.hostname]
    : (await dns.lookup(parsed.hostname, { all: true })).map(({ address }) => address);

  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new Error('URL resolves to a private or local address');
  }
}

function isPrivateAddress(address) {
  if (address.toLowerCase().startsWith('::ffff:')) {
    return isPrivateAddress(address.slice(7));
  }

  if (net.isIPv4(address)) {
    const [first, second] = address.split('.').map(Number);
    return first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224;
  }

  const normalized = address.toLowerCase();
  return normalized === '::' || normalized === '::1' ||
    normalized.startsWith('fc') || normalized.startsWith('fd') ||
    normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb');
}

function injectWatermark(html) {
  const stamp = `
    <div style="position:fixed;bottom:12px;right:16px;font:11px -apple-system,sans-serif;color:#999;opacity:.8;z-index:99999;">
      Made with HTML2PDF · Free plan
    </div>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${stamp}</body>`);
  }
  return html + stamp;
}

async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

module.exports = { convertHtmlToPdf, closeBrowser, ALLOWED_FORMATS };

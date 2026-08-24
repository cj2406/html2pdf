const puppeteer = require('puppeteer-core');

let browserPromise = null;

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
        'PUPPETEER_EXECUTABLE_PATH is not set. Point it at a Chromium/Chrome binary ' +
          '(the Dockerfile does this automatically). See backend/.env.example.'
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
  } = opts;

  if (!html && !url) {
    throw new Error('Either "html" or "url" is required');
  }
  if (!ALLOWED_FORMATS.includes(format)) {
    throw new Error(`Invalid format "${format}". Allowed: ${ALLOWED_FORMATS.join(', ')}`);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    page.setDefaultNavigationTimeout(timeoutMs);

    if (url) {
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
    await page.close();
  }
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

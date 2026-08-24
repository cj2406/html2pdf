/**
 * html2pdf-client
 * ---------------
 * Minimal, dependency-free client for the HTML2PDF conversion API.
 * Works in any Node 18+ backend, or bundle it for the browser (though for
 * production use you'll almost always want to call this from a server so
 * your API key isn't exposed to end users).
 */

class Html2PdfError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'Html2PdfError';
    this.status = status;
    this.data = data;
  }
}

class Html2PdfClient {
  /**
   * @param {Object} opts
   * @param {string} opts.apiKey - your HTML2PDF API key (X-API-Key)
   * @param {string} [opts.baseUrl] - defaults to https://api.html2pdf.example.com
   */
  constructor({ apiKey, baseUrl = 'https://api.html2pdf.example.com' } = {}) {
    if (!apiKey) throw new Error('Html2PdfClient requires an apiKey');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Convert HTML (or a URL) into a PDF.
   * @param {Object} params
   * @param {string} [params.html] - raw HTML to render. Provide this OR params.url.
   * @param {string} [params.url] - a URL to render instead of raw HTML.
   * @param {'A4'|'A3'|'A5'|'Letter'|'Legal'|'Tabloid'} [params.format='A4']
   * @param {boolean} [params.landscape=false]
   * @param {boolean} [params.printBackground=true]
   * @param {{top?:string,right?:string,bottom?:string,left?:string}} [params.margin]
   * @returns {Promise<Buffer>} the PDF file as a Buffer
   */
  async convert(params) {
    if (!params || (!params.html && !params.url)) {
      throw new Error('convert() requires either "html" or "url"');
    }

    const res = await fetch(`${this.baseUrl}/api/v1/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON error body */
      }
      throw new Html2PdfError(data.error || `Conversion failed (${res.status})`, res.status, data);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Check remaining quota for the current API key / billing period. */
  async usage() {
    const res = await fetch(`${this.baseUrl}/api/v1/usage`, {
      headers: { 'X-API-Key': this.apiKey },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Html2PdfError(data.error || `Usage check failed (${res.status})`, res.status, data);
    }
    return res.json();
  }
}

module.exports = { Html2PdfClient, Html2PdfError };

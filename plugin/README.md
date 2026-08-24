# html2pdf-client

Official Node.js client for the HTML2PDF conversion API. Zero dependencies (uses native `fetch`, Node 18+).

## Install

```bash
npm install html2pdf-client
```

(If you haven't published this package to npm yet, use it locally: `npm install ../path/to/plugin`, or `npm link`.)

## Usage

```js
const { Html2PdfClient } = require('html2pdf-client');
// or: import { Html2PdfClient } from 'html2pdf-client';

const client = new Html2PdfClient({
  apiKey: process.env.HTML2PDF_API_KEY,
  baseUrl: 'https://your-domain.com', // your deployed backend
});

// Convert raw HTML
const pdfBuffer = await client.convert({
  html: '<h1>Invoice #204</h1><p>Total: $120.00</p>',
  format: 'A4',
});
fs.writeFileSync('invoice.pdf', pdfBuffer);

// Or convert a live URL
const pdfFromUrl = await client.convert({ url: 'https://example.com/invoice/204' });

// Check remaining quota
const usage = await client.usage();
console.log(usage); // { plan: 'pro', limit: 15000, used: 812, remaining: 14188 }
```

## API

### `new Html2PdfClient({ apiKey, baseUrl })`
- `apiKey` (required) — your API key from the dashboard.
- `baseUrl` (optional) — your HTML2PDF backend URL.

### `client.convert(options) => Promise<Buffer>`
| option | type | default | notes |
|---|---|---|---|
| `html` | string | — | raw HTML. Provide this OR `url`. |
| `url` | string | — | a live URL to render instead of raw HTML. |
| `format` | `'A4'\|'A3'\|'A5'\|'Letter'\|'Legal'\|'Tabloid'` | `'A4'` | page size |
| `landscape` | boolean | `false` | |
| `printBackground` | boolean | `true` | include CSS backgrounds/colors |
| `margin` | `{top,right,bottom,left}` | `1cm` each | CSS length strings |

Throws `Html2PdfError` (with `.status` and `.data`) on failure — including `429` when you're over your monthly quota.

### `client.usage() => Promise<{ plan, limit, used, remaining }>`

## Errors

```js
const { Html2PdfError } = require('html2pdf-client');

try {
  await client.convert({ html: '<h1>Hi</h1>' });
} catch (err) {
  if (err instanceof Html2PdfError && err.status === 429) {
    console.log('Quota exceeded — time to upgrade your plan.');
  }
}
```

# html2pdf-client

Official TypeScript/Node.js client for the HTML2PDF conversion API. It has no runtime dependencies and uses the native `fetch` available in Node 18+ and modern browsers.

## Install

```bash
npm install html2pdf-client
```

## Usage

```ts
import { writeFile } from 'node:fs/promises';
import { Html2PdfClient } from 'html2pdf-client';

const client = new Html2PdfClient({
  apiKey: process.env.HTML2PDF_API_KEY!,
  baseUrl: 'https://your-domain.com',
});

const pdf = await client.convert({
  html: '<h1>Invoice #204</h1><p>Total: $120.00</p>',
  format: 'A4',
});

await writeFile('invoice.pdf', pdf);

const usage = await client.usage();
console.log(usage.remaining);
```

`convert()` accepts either `html` or `url` and returns a `Uint8Array`, which can be passed directly to Node's `writeFile` or converted with `Buffer.from(pdf)`.

## Options

- `apiKey` (required): API key from the HTML2PDF dashboard.
- `baseUrl` (optional): deployed backend URL. Defaults to `https://api.html2pdf.example.com`.
- `format` (optional): `A4`, `A3`, `A5`, `Letter`, `Legal`, or `Tabloid`.
- `landscape` and `printBackground` (optional): PDF rendering flags.
- `margin` (optional): CSS lengths such as `{ top: '1cm', bottom: '1cm' }`.

## Errors

API failures throw `Html2PdfError`, including the HTTP `status` and parsed response `data`.

```ts
import { Html2PdfError } from 'html2pdf-client';

try {
  await client.convert({ html: '<h1>Hello</h1>' });
} catch (error) {
  if (error instanceof Html2PdfError && error.status === 429) {
    console.log('Conversion quota or capacity exceeded.');
  }
}
```

## Publish

From this directory:

```bash
npm install
npm publish
```
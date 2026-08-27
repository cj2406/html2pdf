import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Html2PdfClient, Html2PdfError } from '../dist/index.js';

function createClient(fetchImplementation) {
  return new Html2PdfClient({
    apiKey: 'test-api-key',
    baseUrl: 'https://api.example.test/',
    fetch: fetchImplementation,
  });
}

test('convert sends the API key and conversion options, then returns PDF bytes', async () => {
  let request;
  const client = createClient(async (url, init) => {
    request = { url, init };
    return new Response(Uint8Array.from([37, 80, 68, 70]), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
  });

  const pdf = await client.convert({
    html: '<h1>Hello</h1>',
    format: 'Letter',
    landscape: true,
  });

  assert.deepEqual([...pdf], [37, 80, 68, 70]);
  assert.equal(request.url, 'https://api.example.test/api/v1/convert');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers['X-API-Key'], 'test-api-key');
  assert.equal(request.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.init.body), {
    html: '<h1>Hello</h1>',
    format: 'Letter',
    landscape: true,
  });
});

test('convert accepts a URL as the render source', async () => {
  let body;
  const client = createClient(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(new ArrayBuffer(0), { status: 200 });
  });

  await client.convert({ url: 'https://example.com/invoice' });

  assert.deepEqual(body, { url: 'https://example.com/invoice' });
});

test('convert rejects a request without HTML or URL', async () => {
  const client = createClient(async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(
    client.convert({}),
    { message: 'convert() requires either "html" or "url"' },
  );
});

test('usage returns the service quota response', async () => {
  let request;
  const client = createClient(async (url, init) => {
    request = { url, init };
    return Response.json({ plan: 'pro', limit: 15000, used: 812, remaining: 14188 });
  });

  const usage = await client.usage();

  assert.deepEqual(usage, { plan: 'pro', limit: 15000, used: 812, remaining: 14188 });
  assert.equal(request.url, 'https://api.example.test/api/v1/usage');
  assert.equal(request.init.headers['X-API-Key'], 'test-api-key');
});

test('API errors preserve status and response data', async () => {
  const client = createClient(async () => Response.json(
    { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' },
    { status: 429 },
  ));

  await assert.rejects(client.usage(), (error) => {
    assert.ok(error instanceof Html2PdfError);
    assert.equal(error.message, 'Quota exceeded');
    assert.equal(error.status, 429);
    assert.deepEqual(error.data, { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' });
    return true;
  });
});
test('is true',async()=>{
    let request;
     const client = createClient(async (url, init) => {
    request = { url, init };
    return new Response({
        status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    })
  });

  const pdf = await client.convert({
    html: '<h1>Hello</h1>',
    format: 'Letter',
    landscape: true,
  });

    assert.equal(request.init.method,'POST')
})
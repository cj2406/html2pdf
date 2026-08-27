export type PageFormat = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';

export interface Html2PdfClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface Margin {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface ConvertOptions {
  html?: string;
  url?: string;
  format?: PageFormat;
  landscape?: boolean;
  printBackground?: boolean;
  margin?: Margin;
}

export interface UsageResponse {
  plan: string;
  limit: number;
  used: number;
  remaining: number;
}

export class Html2PdfError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown = {}) {
    super(message);
    this.name = 'Html2PdfError';
    this.status = status;
    this.data = data;
  }
}

interface ErrorResponse {
  error?: string;
  [key: string]: unknown;
}

const DEFAULT_BASE_URL = 'https://api.html2pdf.example.com';

export class Html2PdfClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly requestFetch: typeof globalThis.fetch;

  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetch: fetchImplementation }: Html2PdfClientOptions) {
    if (!apiKey) throw new Error('Html2PdfClient requires an apiKey');

    const requestFetch = fetchImplementation ?? globalThis.fetch;
    if (!requestFetch) throw new Error('Html2PdfClient requires a fetch implementation');

    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.requestFetch = requestFetch;
  }

  async convert(options: ConvertOptions): Promise<Uint8Array> {
    if (!options || (!options.html && !options.url)) {
      throw new Error('convert() requires either "html" or "url"');
    }

    const response = await this.request('/api/v1/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    return new Uint8Array(await response.arrayBuffer());
  }

  async usage(): Promise<UsageResponse> {
    const response = await this.request('/api/v1/usage');
    return response.json() as Promise<UsageResponse>;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.requestFetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        'X-API-Key': this.apiKey,
      },
    });

    if (response.ok) return response;

    let data: ErrorResponse = {};
    try {
      data = (await response.json()) as ErrorResponse;
    } catch {
      // Keep the status-based error when the service returns a non-JSON body.
    }

    throw new Html2PdfError(data.error || `Request failed (${response.status})`, response.status, data);
  }
}

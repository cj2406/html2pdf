export interface Html2PdfClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface ConvertOptions {
  html?: string;
  url?: string;
  format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  printBackground?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
}

export interface UsageResponse {
  plan: string;
  limit: number;
  used: number;
  remaining: number;
}

export class Html2PdfError extends Error {
  status: number;
  data: unknown;
}

export class Html2PdfClient {
  constructor(options: Html2PdfClientOptions);
  convert(options: ConvertOptions): Promise<Buffer>;
  usage(): Promise<UsageResponse>;
}

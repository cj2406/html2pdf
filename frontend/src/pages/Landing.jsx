import { Link } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import CodeBlock from '../components/CodeBlock.jsx';

const CURL_SNIPPET = `curl -X POST https://your-domain.com/api/v1/convert \\
  -H "X-API-Key: h2p_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"html":"<h1>Invoice #204</h1>","format":"A4"}' \\
  --output invoice.pdf`;

const NODE_SNIPPET = `npm install html2pdf-client

import { Html2PdfClient } from "html2pdf-client";

const client = new Html2PdfClient({ apiKey: "h2p_live_xxxxxxxxxxxx" });

const pdfBuffer = await client.convert({
  html: "<h1>Invoice #204</h1>",
  format: "A4",
});`;

const RESPONSE_SNIPPET = `HTTP/1.1 200 OK
Content-Type: application/pdf
X-Plan: pro
X-Quota-Remaining: 14382

<binary PDF data>`;

export default function Landing() {
  return (
    <>
      <Nav />

      <header className="hero wrap">
        <div>
          <p className="eyebrow">// html → pdf, one request</p>
          <h1>Render pixel-perfect PDFs from any HTML, at API speed.</h1>
          <p className="lede">
            A conversion API you can call from a backend, a plugin, or a script. Send HTML or a URL,
            get a PDF back. No headless browser to babysit, no fonts to install.
          </p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" to="/signup">
              Start for free — 50 conversions/mo
            </Link>
            <a className="btn btn-ghost" href="#docs">
              Read the docs
            </a>
          </div>
          <p className="hero-meta">POST /api/v1/convert · returns application/pdf · avg ~600ms for a typical invoice</p>
        </div>

        <div className="stamp-scene">
          <div className="doc">
            <span className="tag">&lt;/&gt; invoice.html</span>
            <div className="line w80"></div>
            <div className="line w60"></div>
            <div className="line w40"></div>
            <div className="line w80"></div>
            <div className="line w60"></div>
            <div className="stamp">
              <span>
                PDF
                <br />✓ READY
              </span>
            </div>
          </div>
        </div>
      </header>

      <section id="features">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">// what you get</p>
            <h2>Built for the part of your app that has to just work</h2>
            <p>Invoices, receipts, reports, certificates — anywhere your product needs to hand someone a real document.</p>
          </div>
          <div className="grid-3">
            <div className="card">
              <span className="num">01</span>
              <h3>HTML or a live URL</h3>
              <p>Send raw HTML with inline styles, or point it at a URL and it renders the live page — including your CSS and web fonts.</p>
            </div>
            <div className="card">
              <span className="num">02</span>
              <h3>Predictable output</h3>
              <p>Choose page format (A4, Letter, Legal...), orientation, margins, and background printing. What you preview is what you get.</p>
            </div>
            <div className="card">
              <span className="num">03</span>
              <h3>Usage-based plans</h3>
              <p>Start free, upgrade when you need more volume. Every plan includes an API key and a usage dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="docs">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">// integrate in a minute</p>
            <h2>One endpoint. Any stack.</h2>
            <p>Call it directly with curl, or drop in the official Node client below.</p>
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            <CodeBlock label="curl" code={CURL_SNIPPET} />
            <CodeBlock label="node — plugin package" code={NODE_SNIPPET} />
          </div>

          <CodeBlock label="response" code={RESPONSE_SNIPPET} />
        </div>
      </section>

      <section id="pricing-preview">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">// pricing</p>
            <h2>Free to try, simple to scale</h2>
            <p>Every plan includes the full API, an API key, and usage tracking.</p>
          </div>
          <p>
            <Link className="btn btn-stamp" to="/pricing">
              See full pricing →
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}

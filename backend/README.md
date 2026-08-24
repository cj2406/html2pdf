# HTML2PDF Backend

Express API that converts HTML (or a URL) to PDF, meters usage against subscription
plans, and bills those plans through a pluggable payment-provider layer (Paystack
today, more can be added without touching the rest of the app).

## Architecture

```
backend/
├── Dockerfile              # installs Chromium so puppeteer-core has a browser to drive
├── prisma/
│   └── schema.prisma       # Postgres schema (users, api_keys, subscriptions, payments, usage_logs)
└── src/
    ├── server.js            # Express app entrypoint
    ├── db/prisma.js         # Prisma client singleton
    ├── middleware/
    │   ├── authJwt.js       # dashboard/account auth (email+password → JWT)
    │   └── authApiKey.js    # API-key auth + monthly quota enforcement for /api/v1/convert
    ├── routes/
    │   ├── auth.js          # signup, login, /me, API key rotation
    │   ├── convert.js        # the actual HTML→PDF endpoint
    │   ├── billing.js        # list plans, start checkout, verify payment, history
    │   └── webhooks.js       # provider-agnostic webhook receiver
    └── services/
        ├── pdfService.js     # Puppeteer wrapper (HTML/URL → PDF buffer)
        ├── plans.js           # plan definitions (limits, pricing)
        └── payments/
            ├── PaymentProvider.js   # abstract interface every provider implements
            ├── PaystackProvider.js  # Paystack implementation
            └── index.js              # provider registry/factory
```

### Why a payment-provider interface?

Routes never call Paystack's SDK directly — they call `getProvider(name)` from
`services/payments`, which returns something implementing `PaymentProvider`.
To add Stripe, Flutterwave, etc. later:

1. Create `services/payments/StripeProvider.js extends PaymentProvider` and
   implement `initializeTransaction`, `verifyTransaction`,
   `verifyWebhookSignature`, `parseWebhookEvent`, `cancelSubscription`.
2. Register it in `services/payments/index.js`'s `PROVIDERS` map.
3. Add its API keys to `.env`.

Nothing in `routes/billing.js` or `routes/webhooks.js` needs to change — the
frontend already sends a `provider` field and can offer a picker once more
than one is registered.

## Running with Docker (recommended)

This spins up Postgres, the API (with Chromium baked in), and a static server
for the frontend, from the repo root:

```bash
cp backend/.env.example backend/.env
# edit backend/.env: set JWT_SECRET, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY

docker compose up --build
```

- API: http://localhost:4000
- Frontend: http://localhost:8080
- Postgres: localhost:5432 (user/pass/db: `html2pdf`)

Migrations run automatically on container start (`prisma migrate deploy`).
For the very first run, generate the initial migration once (from your host,
with `DATABASE_URL` pointed at the running Postgres container):

```bash
cd backend
npx prisma migrate dev --name init
```

## Running without Docker

You'll need your own Postgres and a Chromium/Chrome binary.

```bash
cd backend
cp .env.example .env
# set DATABASE_URL to your Postgres instance
# set PUPPETEER_EXECUTABLE_PATH to your local Chromium/Chrome binary

npm install
npx prisma migrate dev --name init
npm run dev
```

## Environment variables

See `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | signs dashboard auth tokens — set a long random string |
| `DATABASE_URL` | Postgres connection string (Prisma) |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | from your Paystack dashboard |
| `DEFAULT_PAYMENT_PROVIDER` | which provider to use when the frontend doesn't specify one |
| `PUPPETEER_EXECUTABLE_PATH` | path to Chromium — set automatically by the Dockerfile |

## Subscription plans

Defined in `src/services/plans.js`: `free`, `starter`, `pro`, `business` —
each with a monthly conversion quota, max payload size, concurrency
allowance, and (free only) a watermark. Edit that file to change pricing or
limits; nothing else needs to change.

## API reference

All authenticated dashboard routes take `Authorization: Bearer <JWT>`.
The conversion API takes `X-API-Key: <key>` instead — that's what you give
to people integrating the plugin/SDK.

## Auth model

Two separate, unrelated auth mechanisms live side by side:

- **Dashboard/browser session** — httpOnly cookie (`h2p_session`, holding the
  JWT) set on `/api/auth/login` and `/api/auth/signup`. It's never exposed to
  JS, so it can't be stolen via an XSS payload. A second, deliberately
  **non**-httpOnly cookie (`h2p_csrf`) is set alongside it; the frontend
  reads that value and echoes it back as an `X-CSRF-Token` header on every
  state-changing request (double-submit CSRF pattern — see
  `src/middleware/csrf.js`). Safe methods (GET) skip this check.
- **API key** (`X-API-Key` header) — for the actual conversion API. Meant for
  server-to-server calls (your backend or the `html2pdf-client` plugin), so
  there's no browser session, no cookies, and no CSRF concern here.

In production (`NODE_ENV=production`), both cookies are set with
`SameSite=None; Secure`, which **requires HTTPS** on both the frontend and
backend domains. `FRONTEND_URL` in `.env` must exactly match where the
frontend is served from — CORS requires an explicit origin (never `*`) when
cookies/credentials are involved.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password }` | creates user, free subscription, first API key; sets session + CSRF cookies |
| POST | `/api/auth/login` | `{ email, password }` | sets session + CSRF cookies |
| POST | `/api/auth/logout` | — | clears both cookies |
| GET | `/api/auth/me` | — | user, subscription, api keys (cookie session) |
| POST | `/api/auth/api-keys/rotate` | — | revokes old key, issues a new one (cookie session + CSRF header) |

### Conversion
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/convert` | `{ html\|url, format?, landscape?, printBackground?, margin? }` | returns `application/pdf` binary (API key) |
| GET | `/api/v1/usage` | — | `{ plan, limit, used, remaining }` (API key) |

### Billing
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/billing/plans` | — | public, lists all plans + available providers |
| POST | `/api/billing/subscribe` | `{ planId, provider? }` | starts checkout, returns `authorizationUrl` (cookie session + CSRF header) |
| GET | `/api/billing/verify/:reference?provider=paystack` | — | confirms a completed checkout (cookie session; see code comment on why this GET is exempt from CSRF) |
| GET | `/api/billing/history` | — | past payments (cookie session) |

### Webhooks
| Method | Path | Notes |
|---|---|---|
| POST | `/api/webhooks/:provider` | e.g. `/api/webhooks/paystack` — set this as your Paystack webhook URL |

## Setting up the Paystack webhook

In the Paystack dashboard → Settings → API Keys & Webhooks, set the webhook
URL to `https://your-domain.com/api/webhooks/paystack`. This backend verifies
every webhook's `x-paystack-signature` header (HMAC-SHA512 against your
secret key) before trusting it — never disable that check.

## Notes on the PDF engine

`pdfService.js` uses `puppeteer-core` (not `puppeteer`), meaning it does not
try to download its own Chromium — it drives whatever binary
`PUPPETEER_EXECUTABLE_PATH` points to. The Dockerfile installs Chromium via
`apt` and sets that variable for you. This avoids the common deployment
headache of Puppeteer's bundled-Chromium download failing in restricted or
serverless network environments.

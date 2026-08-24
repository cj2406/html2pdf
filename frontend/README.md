# HTML2PDF Frontend

A React (Vite) single-page app: landing page, pricing, signup/login, and a
dashboard. Talks to the backend over plain `fetch`, using an httpOnly
session cookie for auth (not a token in localStorage) — see
[Auth model](#auth-model) below.

## Structure

```
frontend/
├── Dockerfile           # multi-stage: vite build → serve dist/ with nginx
├── nginx.conf            # SPA fallback (routes like /dashboard aren't real files)
├── src/
│   ├── main.jsx           # entry point, wraps App in BrowserRouter
│   ├── App.jsx             # route definitions
│   ├── config.js           # reads VITE_API_BASE_URL
│   ├── index.css            # design system (ported 1:1 from the original static build)
│   ├── api/
│   │   └── client.js         # fetch wrapper — cookies + CSRF header
│   ├── context/
│   │   └── AuthContext.jsx    # app-wide login state (calls /api/auth/me once, shares it)
│   ├── components/
│   │   ├── Nav.jsx, Footer.jsx, CodeBlock.jsx
│   │   └── ProtectedRoute.jsx  # redirects to /login if not authenticated
│   └── pages/
│       ├── Landing.jsx, Pricing.jsx, Signup.jsx, Login.jsx
│       ├── Dashboard.jsx        # wrapped in <ProtectedRoute>
│       └── BillingCallback.jsx   # where Paystack redirects after checkout
```

## Running locally

```bash
cd frontend
cp .env.example .env
npm install
npm run dev       # http://localhost:5173, hot reload
```

Make sure the backend is running too (see `../backend/README.md`) and that
its `FRONTEND_URL` matches wherever this dev server actually runs — CORS
with cookies requires an exact origin match. If you use Vite's default dev
port (5173) instead of the docker-compose default (8080), update
`backend/.env`'s `FRONTEND_URL` accordingly and restart the backend.

## Building

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build locally to sanity-check it
```

`VITE_API_BASE_URL` is baked into the bundle **at build time** — Vite
doesn't read env vars at runtime like a server would. If you change it,
you must rebuild. The Dockerfile takes it as a build arg for exactly this
reason (`docker compose build --build-arg VITE_API_BASE_URL=...` or edit
the `args:` in `docker-compose.yml`).

## Auth model

Two cookies, set by the backend on `/api/auth/login` and `/api/auth/signup`:

- `h2p_session` — httpOnly, holds the JWT. Never touched by JS. `AuthContext`
  doesn't read it directly; it just calls `GET /api/auth/me` and lets the
  browser attach the cookie automatically (`credentials: 'include'` in
  `api/client.js`).
- `h2p_csrf` — **not** httpOnly, deliberately readable by JS. On every
  mutating request (`POST`/`PUT`/`PATCH`/`DELETE`), `api/client.js` reads
  this cookie's value and sends it back as an `X-CSRF-Token` header. The
  backend checks the header matches the cookie (double-submit CSRF pattern)
  before allowing the request through.

`isLoggedIn()` in `api/client.js` just checks whether `h2p_csrf` is present
— it's a cheap UI signal only (show "Dashboard" vs "Log in" in the nav), not
a security boundary. The backend independently re-verifies the real
`h2p_session` cookie on every request regardless of what the frontend
thinks.

`ProtectedRoute` redirects to `/login` if `AuthContext` doesn't have an
active session after checking — it waits for the initial `/api/auth/me`
call to resolve rather than flashing the dashboard and then bouncing.

## Why React Router needs the nginx SPA fallback

Routes like `/dashboard` or `/pricing` aren't real files — React Router
renders them client-side based on the URL. If someone loads `/dashboard`
directly (not via an in-app link) or refreshes the page, nginx would 404
looking for a literal file at that path unless it's told to fall back to
`index.html` and let React Router take over. That's what
`try_files $uri $uri/ /index.html;` in `nginx.conf` does.

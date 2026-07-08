# Premier Performance GK — Deployment & Base44 Removal Guide

## Base44 Removal Checklist

The following files and imports exist **only** to satisfy the Base44 editor
preview environment. Every item below is safe to delete for production builds.
The application's auth, routing, and data access do not call any of them at runtime.

### Files to delete

| File | Why it exists | Safe to delete? |
|---|---|---|
| `src/lib/AuthContext.jsx` | Base44 editor shim | ✅ Yes |
| `src/api/base44Client.js` | Base44 editor shim | ✅ Yes |
| `src/components/ProtectedRoute.jsx` | Base44 editor shim (uses `src/lib/AuthContext`) | ✅ Yes |

### Imports to remove from `src/App.jsx`

```jsx
// REMOVE these lines:
import { AuthProvider as Base44PreviewProvider } from '@/lib/AuthContext';

// REMOVE the wrapper from the JSX:
<Base44PreviewProvider>
  ...
</Base44PreviewProvider>

// REPLACE with just the children:
<AuthProvider>
  ...
</AuthProvider>
```

### Package to uninstall

```bash
npm uninstall @base44/sdk
```

### Verify production build

After making the above changes:

```bash
npm run build
```

The build will succeed because:
- `src/App.jsx` uses `src/contexts/AuthContext.jsx` for all auth state (no SDK)
- All protected routes use `src/components/AppProtectedRoute.jsx` (no Base44 ProtectedRoute)
- All API calls go through `src/services/apiClient.js` → `/api/*` → Cloudflare Worker
- No page or component imports from `@base44/sdk`, `@/api/base44Client`, or `@/lib/AuthContext`

---

## Cloudflare Deployment Steps

### 1. Create D1 database

```bash
npx wrangler d1 create ppgk
# Copy the database_id into wrangler.toml
```

### 2. Run migrations

```bash
npx wrangler d1 execute ppgk --file=migrations/0001_initial_schema.sql
npx wrangler d1 execute ppgk --file=migrations/0002_additions.sql
```

### 3. Set secrets (never commit these)

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put STRIPE_SECRET
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put APP_URL
```

### 4. Build frontend

```bash
npm run build
```

### 5. Deploy worker

```bash
npx wrangler deploy
```

### 6. Deploy frontend (Cloudflare Pages)

```bash
npx wrangler pages deploy dist --project-name=ppgk
```

### 7. Configure Stripe webhook

In the Stripe dashboard, create a webhook pointing to:
```
https://your-worker.your-subdomain.workers.dev/api/webhooks/stripe
```

Select events: `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`

Copy the signing secret and set it: `npx wrangler secret put STRIPE_WEBHOOK_SECRET`

---

## Required Environment Variables / Secrets

| Name | Description | Source |
|---|---|---|
| `JWT_SECRET` | 32+ random hex chars for JWT signing | `openssl rand -hex 32` |
| `STRIPE_SECRET` | Stripe API secret key | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe webhook config |
| `RESEND_API_KEY` | Resend transactional email key | resend.com dashboard |
| `APP_URL` | Full URL of the deployed app | Your domain |
| `DB` | D1 binding (set in wrangler.toml) | `wrangler d1 create` |
| `RATE_LIMIT` (optional) | KV namespace for login rate limiting | `wrangler kv:namespace create RATE_LIMIT` |

---

## No Secrets in Source Control

Confirmed: no secret values appear in any committed file.
- `wrangler.toml` references secret names only with comments, no values
- Auth keys, Stripe keys, and API keys are set via `wrangler secret put` only
- `.gitignore` should include `.dev.vars` (local dev secrets file for wrangler)

---

## Dev Environment (dev.ppgk.app)

Branch workflow: **feature branch → `dev` → test on dev.ppgk.app → `main` → ppgk.app**

The dev stack is fully isolated from production:

| | Production | Dev |
|---|---|---|
| Branch | `main` | `dev` |
| Domain | ppgk.app | dev.ppgk.app |
| Worker | `ppgk` (top-level config) | `ppgk-dev` (`[env.dev]`) |
| D1 | `ppgk-production` | `ppgk-dev` |
| R2 | `ppgk` | `ppgk-dev` |
| Stripe | live keys (when launched) | **test keys only** |
| Secrets | `wrangler secret put <NAME>` | `wrangler secret put <NAME> --env dev` |

### One-time setup

```bash
# 1. Fill in the ppgk-dev database_id in wrangler.toml [env.dev]
npx wrangler d1 list                          # copy the ppgk-dev ID

# 2. Create the dev R2 bucket
npx wrangler r2 bucket create ppgk-dev

# 3. Apply migrations to ppgk-dev (remote) — production is untouched
npx wrangler d1 migrations apply ppgk-dev --remote --env dev

# 4. Dev secrets (Stripe TEST keys only)
npx wrangler secret put JWT_SECRET            --env dev
npx wrangler secret put STRIPE_SECRET         --env dev
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env dev
npx wrangler secret put RESEND_API_KEY        --env dev

# 5. Stripe sandbox: add a second webhook endpoint →
#    https://dev.ppgk.app/api/webhooks/stripe
#    (events: checkout.session.completed, payment_intent.payment_failed,
#     charge.refunded) and use ITS signing secret in step 4.
```

### Deploying

```bash
# Dev API worker (route dev.ppgk.app/api/*)
npx wrangler deploy --env dev

# Dev frontend — Pages preview deployment on the dev branch alias
git checkout dev && npm run build
npx wrangler pages deploy dist --project-name=ppgk --branch=dev

# Production (unchanged)
npx wrangler deploy
npx wrangler pages deploy dist --project-name=ppgk
```

### dev.ppgk.app DNS / Pages

The Pages deployment with `--branch=dev` is served at the branch alias
`dev.ppgk.pages.dev`. Point the custom domain at it: Cloudflare dashboard →
ppgk.app zone → DNS → add a **CNAME** record `dev` → `dev.ppgk.pages.dev`
(proxied). The `[env.dev]` worker route then intercepts
`dev.ppgk.app/api/*`, exactly as production does on ppgk.app.

### Safety rails

- Non-production hostnames render a fixed **DEV ENVIRONMENT** badge
  (`src/components/EnvironmentBadge.jsx`).
- `GET /api/health` reports `{ "env": "development" | "production" }`.
- CORS allows only the deployment's own `APP_URL` origin (+ localhost) —
  dev cannot call the production API from the browser and vice versa.
- The Vite dev-server proxy targets dev.ppgk.app by default, never
  production (`PPGK_API_PROXY_TARGET` overrides).

---

## Running Tests

```bash
node worker/tests/booking.test.js
```

Expected output: all tests pass, exit 0.
Tests are pure JavaScript with no external dependencies, no Base44, no D1 required.
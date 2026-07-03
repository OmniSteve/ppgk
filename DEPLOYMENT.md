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

## Running Tests

```bash
node worker/tests/booking.test.js
```

Expected output: all tests pass, exit 0.
Tests are pure JavaScript with no external dependencies, no Base44, no D1 required.
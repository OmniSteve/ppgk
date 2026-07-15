/**
 * Premier Performance GK — Cloudflare Worker Entry Point
 *
 * All API routes are served from /api/*.
 * Static assets (React app) are served by Cloudflare Pages binding.
 *
 * Environment bindings expected in wrangler.toml:
 *   DB                    — D1 database binding
 *   JWT_SECRET            — Secret for signing JWTs (min 32 chars)
 *   STRIPE_SECRET         — Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET — Stripe webhook signing secret (whsec_...)
 *   RESEND_API_KEY        — Resend API key for transactional email
 *   APP_URL               — App base URL (e.g. https://premierperformancegk.com)
 *   APP_ENV               — 'production' | 'staging' | 'development'
 */

import { Router }          from './lib/router.js';
import { corsHeaders }     from './lib/cors.js';
import { handleScheduled } from './scheduled.js';

// Auth routes
import { handleRegister }       from './routes/auth/register.js';
import { handleLogin }          from './routes/auth/login.js';
import { handleLogout }         from './routes/auth/logout.js';
import { handleMe }             from './routes/auth/me.js';
import { handleForgotPassword } from './routes/auth/forgot-password.js';
import { handleResetPassword }  from './routes/auth/reset-password.js';
import { handleVerifyEmail }          from './routes/auth/verify-email.js';
import { handleResendVerification }   from './routes/auth/resend-verification.js';
import { handleRefreshToken }         from './routes/auth/refresh.js';

// Admin routes
import { handleAdminDashboard }             from './routes/admin/dashboard.js';
import { handleAdminClients }               from './routes/admin/clients.js';
import { handleAdminPlayers }               from './routes/admin/players.js';
import { handleAdminCoaches }               from './routes/admin/coaches.js';
import { handleAdminLocations }             from './routes/admin/locations.js';
import { handleAdminSessionTypes }          from './routes/admin/session-types.js';
import { handleAdminSessions }              from './routes/admin/sessions.js';
import { handleAdminBookings }              from './routes/admin/bookings.js';
import { handleAdminAttendance }            from './routes/admin/attendance.js';
import { handleAdminPackages }              from './routes/admin/packages.js';
import { handleAdminPayments }              from './routes/admin/payments.js';
import { handleAdminCredits }               from './routes/admin/credits.js';
import { handleAdminNotifications }         from './routes/admin/notifications.js';
import { handleAdminNotificationTemplates } from './routes/admin/notification-templates.js';
import { handleAdminReports }               from './routes/admin/reports.js';
import { handleAdminAuditLog }              from './routes/admin/audit.js';
import { handleAdminSettings }              from './routes/admin/settings.js';
import { handleDebugEmail }                from './routes/admin/debug-email.js';
import { handleEmergencyReset }           from './routes/admin/emergency-reset.js';

// Client routes
import { handleClientDashboard }     from './routes/client/dashboard.js';
import { handleClientSessions }      from './routes/client/sessions.js';
import { handleClientBookings }      from './routes/client/bookings.js';
import { handleClientPlayers }       from './routes/client/players.js';
import { handleClientPackages }      from './routes/client/packages.js';
import { handleClientCredits }       from './routes/client/credits.js';
import { handleClientNotifications } from './routes/client/notifications.js';
import { handleClientAccount }       from './routes/client/account.js';
import { handleCheckout }            from './routes/client/checkout.js';

// Coach routes
import { handleCoachDashboard }  from './routes/coach/dashboard.js';
import { handleCoachSessions }   from './routes/coach/sessions.js';
import { handleCoachAttendance } from './routes/coach/attendance.js';
import { handleCoachRoster }     from './routes/coach/roster.js';

// Player performance routes
import { handlePlayerPerformance }       from './routes/player-performance.js';
import { handleClientPlayerPerformance } from './routes/client/player-performance.js';

// Store — public
import { handleStoreProducts, handleStoreCategories } from './routes/store/products.js';
import { handleStoreImage }                            from './routes/store/images.js';
import { handleStoreCheckout }                         from './routes/store/checkout.js';
import { handleStoreOrders }                           from './routes/store/orders.js';
import { handleStorePublicSettings }                   from './routes/store/settings.js';

// Store — admin
import { handleAdminStoreProducts }   from './routes/admin/store/products.js';
import { handleAdminStoreCategories } from './routes/admin/store/categories.js';
import { handleAdminStoreImages }     from './routes/admin/store/images.js';
import { handleAdminStoreInventory }  from './routes/admin/store/inventory.js';
import { handleAdminStoreOrders }     from './routes/admin/store/orders.js';

// Stripe webhook
import { handleStripeWebhook } from './routes/webhooks/stripe.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Only handle /api/* here; everything else goes to Pages
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    try {
      const router = new Router(request, env, ctx);

      // ── Webhooks (no auth) ──────────────────────────────────────────────
      router.post('/api/webhooks/stripe', handleStripeWebhook);

      // ── Auth ────────────────────────────────────────────────────────────
      router.post('/api/auth/register',        handleRegister);
      router.post('/api/auth/login',           handleLogin);
      router.post('/api/auth/logout',          handleLogout);
      router.get ('/api/auth/me',              handleMe);
      router.post('/api/auth/forgot-password', handleForgotPassword);
      router.post('/api/auth/reset-password',  handleResetPassword);
      router.post('/api/auth/verify-email',           handleVerifyEmail);
      router.post('/api/auth/resend-verification',    handleResendVerification);
      router.post('/api/auth/refresh',                handleRefreshToken);

      // ── Admin ────────────────────────────────────────────────────────────
      router.get  ('/api/admin/dashboard',                            handleAdminDashboard);
      router.get  ('/api/admin/clients',                              handleAdminClients);
      router.get  ('/api/admin/clients/:id',                          handleAdminClients);
      router.put  ('/api/admin/clients/:id',                          handleAdminClients);
      router.patch('/api/admin/clients/:id',                          handleAdminClients);
      router.delete('/api/admin/clients/:id',                         handleAdminClients);
      router.get  ('/api/admin/clients/:id/deactivation-impact',      handleAdminClients);
      router.get  ('/api/admin/clients/:id/deletion-eligibility',     handleAdminClients);
      router.post ('/api/admin/clients/:id/deactivate',               handleAdminClients);
      router.post ('/api/admin/clients/:id/reactivate',               handleAdminClients);
      router.get  ('/api/admin/players',                              handleAdminPlayers);
      router.get  ('/api/admin/players/:id',                          handleAdminPlayers);
      router.patch('/api/admin/players/:id',                          handleAdminPlayers);
      router.delete('/api/admin/players/:id',                         handleAdminPlayers);
      router.get  ('/api/admin/players/:id/deactivation-impact',      handleAdminPlayers);
      router.get  ('/api/admin/players/:id/deletion-eligibility',     handleAdminPlayers);
      router.post ('/api/admin/players/:id/deactivate',               handleAdminPlayers);
      router.post ('/api/admin/players/:id/reactivate',               handleAdminPlayers);
      router.get  ('/api/admin/coaches',                              handleAdminCoaches);
      router.post ('/api/admin/coaches/sync',                         handleAdminCoaches);
      router.post ('/api/admin/coaches',                              handleAdminCoaches);
      router.put  ('/api/admin/coaches/:id',                          handleAdminCoaches);
      router.delete('/api/admin/coaches/:id',                         handleAdminCoaches);
      router.get  ('/api/admin/coaches/:id/deactivation-impact',      handleAdminCoaches);
      router.get  ('/api/admin/coaches/:id/deletion-eligibility',     handleAdminCoaches);
      router.post ('/api/admin/coaches/:id/deactivate',               handleAdminCoaches);
      router.post ('/api/admin/coaches/:id/reactivate',               handleAdminCoaches);
      router.get  ('/api/admin/locations',                            handleAdminLocations);
      router.post ('/api/admin/locations',                            handleAdminLocations);
      router.put  ('/api/admin/locations/:id',                        handleAdminLocations);
      router.get  ('/api/admin/session-types',                        handleAdminSessionTypes);
      router.post ('/api/admin/session-types',                        handleAdminSessionTypes);
      router.put  ('/api/admin/session-types/:id',                    handleAdminSessionTypes);
      router.get  ('/api/admin/sessions',                             handleAdminSessions);
      router.post ('/api/admin/sessions',                             handleAdminSessions);
      router.get  ('/api/admin/sessions/:id',                         handleAdminSessions);
      router.put  ('/api/admin/sessions/:id',                         handleAdminSessions);
      router.patch ('/api/admin/sessions/:id',                        handleAdminSessions);
      router.delete('/api/admin/sessions/:id',                        handleAdminSessions);
      router.get  ('/api/admin/bookings',                             handleAdminBookings);
      router.patch('/api/admin/bookings/:id',                         handleAdminBookings);
      router.get  ('/api/admin/attendance',                           handleAdminAttendance);
      router.patch('/api/admin/attendance/:id',                       handleAdminAttendance);
      router.get  ('/api/admin/packages',                             handleAdminPackages);
      router.post ('/api/admin/packages',                             handleAdminPackages);
      router.put  ('/api/admin/packages/:id',                         handleAdminPackages);
      router.patch('/api/admin/packages/:id',                         handleAdminPackages);
      router.get  ('/api/admin/payments',                             handleAdminPayments);
      router.post ('/api/admin/payments/:id/refund',                  handleAdminPayments);
      router.get  ('/api/admin/credits',                              handleAdminCredits);
      router.get  ('/api/admin/credits/search-players',                handleAdminCredits);
      router.post ('/api/admin/credits/grant',                        handleAdminCredits);
      router.get  ('/api/admin/notifications',                        handleAdminNotifications);
      router.get  ('/api/admin/notification-templates',               handleAdminNotificationTemplates);
      router.post ('/api/admin/notification-templates',               handleAdminNotificationTemplates);
      router.put  ('/api/admin/notification-templates/:id',           handleAdminNotificationTemplates);
      router.post ('/api/admin/notification-templates/:id/test',      handleAdminNotificationTemplates);
      router.get  ('/api/admin/reports/:type',                        handleAdminReports);
      router.get  ('/api/admin/reports/:type/export',                 handleAdminReports);
      router.get  ('/api/admin/audit',                                handleAdminAuditLog);
      router.get  ('/api/admin/settings',                             handleAdminSettings);
      router.get  ('/api/admin/debug-email',                          handleDebugEmail);
      router.post ('/api/admin/emergency-reset',                      handleEmergencyReset);
      router.put  ('/api/admin/settings',                             handleAdminSettings);

      // ── Client ───────────────────────────────────────────────────────────
      router.get  ('/api/dashboard/client',            handleClientDashboard);
      router.get  ('/api/sessions',                    handleClientSessions);
      router.get  ('/api/sessions/:id',                handleClientSessions);
      router.get  ('/api/bookings',                    handleClientBookings);
      router.post ('/api/bookings',                    handleClientBookings);
      router.get  ('/api/bookings/:id',                handleClientBookings);
      router.get  ('/api/bookings/:id/calendar',       handleClientBookings);
      router.patch('/api/bookings/:id',                handleClientBookings);
      router.post ('/api/bookings/:id/cancel',         handleClientBookings);
      router.post ('/api/bookings/:id/reschedule',     handleClientBookings);
      router.get  ('/api/players',                     handleClientPlayers);
      router.post ('/api/players',                     handleClientPlayers);
      router.get  ('/api/players/:id',                 handleClientPlayers);
      router.put  ('/api/players/:id',                 handleClientPlayers);
      router.get  ('/api/packages',                    handleClientPackages);
      router.post ('/api/packages/:id/purchase',       handleClientPackages);
      router.get  ('/api/credits',                     handleClientCredits);
      router.get  ('/api/notifications',               handleClientNotifications);
      router.patch('/api/notifications/:id/read',      handleClientNotifications);
      router.get  ('/api/account',                     handleClientAccount);
      router.put  ('/api/account',                     handleClientAccount);
      router.post ('/api/checkout',                    handleCheckout);
      router.get  ('/api/client/player-performance/player/:playerId', handleClientPlayerPerformance);

      // ── Coach ─────────────────────────────────────────────────────────────
      router.get ('/api/coach/dashboard',               handleCoachDashboard);
      router.get ('/api/coach/sessions',                handleCoachSessions);
      router.get ('/api/coach/sessions/:id',            handleCoachSessions);
      router.get ('/api/coach/sessions/:id/attendees',  handleCoachSessions);
      router.post('/api/coach/attendance',              handleCoachAttendance);
      router.patch('/api/coach/attendance/:id',         handleCoachAttendance);
      router.get  ('/api/coach/sessions/:id/roster',              handleCoachRoster);
      router.patch('/api/coach/sessions/:id/roster/:bookingId',   handleCoachRoster);

      // ── Player Performance (admin/head_coach/coach) ─────────────────────────
      router.get   ('/api/player-performance/player/:playerId', handlePlayerPerformance);
      router.get   ('/api/player-performance/:id',               handlePlayerPerformance);
      router.post  ('/api/player-performance',                   handlePlayerPerformance);
      router.put   ('/api/player-performance/:id',                handlePlayerPerformance);
      router.delete('/api/player-performance/:id',                handlePlayerPerformance);

      // ── Store — public ───────────────────────────────────────────────────
      router.get  ('/api/store/products',                handleStoreProducts);
      router.get  ('/api/store/products/:slug',           handleStoreProducts);
      router.get  ('/api/store/categories',               handleStoreCategories);
      router.get  ('/api/store/settings',                 handleStorePublicSettings);
      router.get  ('/api/store/images/:id',               handleStoreImage);
      router.post ('/api/store/orders',                   handleStoreCheckout);
      router.post ('/api/store/checkout',                 handleStoreCheckout);
      router.get  ('/api/store/orders',                   handleStoreOrders);
      router.get  ('/api/store/orders/guest/:token',      handleStoreOrders);

      // ── Store — admin ────────────────────────────────────────────────────
      router.get   ('/api/admin/store/products',                          handleAdminStoreProducts);
      router.post  ('/api/admin/store/products',                          handleAdminStoreProducts);
      router.get   ('/api/admin/store/products/:id',                      handleAdminStoreProducts);
      router.patch ('/api/admin/store/products/:id',                      handleAdminStoreProducts);
      router.delete('/api/admin/store/products/:id',                      handleAdminStoreProducts);
      router.get   ('/api/admin/store/products/:id/deletion-eligibility', handleAdminStoreProducts);
      router.post  ('/api/admin/store/repair-skus',                       handleAdminStoreProducts);
      router.post  ('/api/admin/store/products/:id/variants',             handleAdminStoreProducts);
      router.patch ('/api/admin/store/products/:id/variants/:variantId',  handleAdminStoreProducts);
      router.delete('/api/admin/store/products/:id/variants/:variantId',  handleAdminStoreProducts);
      router.get   ('/api/admin/store/products/:id/images',               handleAdminStoreImages);
      router.post  ('/api/admin/store/products/:id/images',               handleAdminStoreImages);
      router.patch ('/api/admin/store/products/:id/images/:imageId',      handleAdminStoreImages);
      router.delete('/api/admin/store/products/:id/images/:imageId',      handleAdminStoreImages);
      router.get   ('/api/admin/store/categories',                        handleAdminStoreCategories);
      router.post  ('/api/admin/store/categories',                        handleAdminStoreCategories);
      router.patch ('/api/admin/store/categories/:id',                    handleAdminStoreCategories);
      router.get   ('/api/admin/store/categories/:id/deletion-eligibility', handleAdminStoreCategories);
      router.delete('/api/admin/store/categories/:id',                    handleAdminStoreCategories);
      router.get   ('/api/admin/store/inventory/low-stock',                handleAdminStoreInventory);
      router.post  ('/api/admin/store/inventory/adjust',                   handleAdminStoreInventory);
      router.get   ('/api/admin/store/orders',                             handleAdminStoreOrders);
      router.get   ('/api/admin/store/orders/:id',                         handleAdminStoreOrders);
      router.patch ('/api/admin/store/orders/:id',                         handleAdminStoreOrders);
      router.post  ('/api/admin/store/orders/:id/refund',                  handleAdminStoreOrders);
      router.post  ('/api/admin/store/orders/:id/notes',                   handleAdminStoreOrders);

      return await router.handle();
    } catch (err) {
      // Auth helpers (requireAuth/requireRole) throw errors carrying a `status`
      // (401/403). Honour that so the frontend can react correctly instead of
      // receiving a misleading 500.
      const status = (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600)
        ? err.status
        : 500;
      if (status === 500) console.error('Unhandled worker error:', err);
      if (err && err.code === 'ACCOUNT_INACTIVE') {
        return Response.json({ error: 'ACCOUNT_INACTIVE', message: err.message }, { status });
      }
      return Response.json(
        { error: status === 500 ? 'Internal server error' : (err.message || 'Error') },
        { status }
      );
    }
  },

  // Scheduled handler
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
};
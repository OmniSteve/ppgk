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
import { handleVerifyEmail }    from './routes/auth/verify-email.js';
import { handleRefreshToken }   from './routes/auth/refresh.js';

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

// Client routes
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
      router.post('/api/auth/verify-email',    handleVerifyEmail);
      router.post('/api/auth/refresh',         handleRefreshToken);

      // ── Admin ────────────────────────────────────────────────────────────
      router.get  ('/api/admin/dashboard',                            handleAdminDashboard);
      router.get  ('/api/admin/clients',                              handleAdminClients);
      router.get  ('/api/admin/clients/:id',                          handleAdminClients);
      router.put  ('/api/admin/clients/:id',                          handleAdminClients);
      router.patch('/api/admin/clients/:id',                          handleAdminClients);
      router.get  ('/api/admin/players',                              handleAdminPlayers);
      router.get  ('/api/admin/coaches',                              handleAdminCoaches);
      router.post ('/api/admin/coaches',                              handleAdminCoaches);
      router.put  ('/api/admin/coaches/:id',                          handleAdminCoaches);
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
      router.patch('/api/admin/sessions/:id',                         handleAdminSessions);
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
      router.put  ('/api/admin/settings',                             handleAdminSettings);

      // ── Client ───────────────────────────────────────────────────────────
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

      // ── Coach ─────────────────────────────────────────────────────────────
      router.get ('/api/coach/dashboard',               handleCoachDashboard);
      router.get ('/api/coach/sessions',                handleCoachSessions);
      router.get ('/api/coach/sessions/:id',            handleCoachSessions);
      router.get ('/api/coach/sessions/:id/attendees',  handleCoachSessions);
      router.post('/api/coach/attendance',              handleCoachAttendance);
      router.patch('/api/coach/attendance/:id',         handleCoachAttendance);

      return await router.handle();
    } catch (err) {
      console.error('Unhandled worker error:', err);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },

  // Scheduled handler
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
};
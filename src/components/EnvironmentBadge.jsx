/**
 * Fixed "DEV ENVIRONMENT" badge shown on every hostname EXCEPT production
 * (ppgk.app / www.ppgk.app) — so it appears on dev.ppgk.app, preview URLs
 * and localhost, and can never appear in production. Hostname-based on
 * purpose: it needs no build-time configuration and cannot drift from the
 * domain actually being used.
 */
const PROD_HOSTNAMES = ['ppgk.app', 'www.ppgk.app'];

export default function EnvironmentBadge() {
  if (PROD_HOSTNAMES.includes(window.location.hostname)) return null;
  return (
    <div className="fixed bottom-3 left-3 z-[9999] px-2.5 py-1 rounded-lg bg-amber-400 text-black text-[11px] font-black tracking-widest shadow-lg pointer-events-none select-none">
      DEV ENVIRONMENT
    </div>
  );
}

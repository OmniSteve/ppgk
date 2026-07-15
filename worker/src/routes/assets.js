/**
 * GET /api/assets/favicon.png
 * GET /api/assets/logo_small.png
 *
 * Streams fixed site assets from R2. These are deliberately single fixed-key
 * routes rather than a generic R2 proxy (see routes/store/images.js for why
 * arbitrary multi-segment R2 keys can't be captured as a single :param by
 * this app's exact-segment router) — each route serves only its one object.
 *
 * Environment-aware for free: these routes live under the existing /api/*
 * Worker route (already active for both ppgk.app and dev.ppgk.app — no new
 * Cloudflare route pattern needed), and env.STORAGE already resolves to a
 * different R2 bucket per environment (ppgk-dev vs ppgk). The frontend calls
 * these via relative "/api/assets/..." URLs, so it automatically hits the
 * correct bucket for whichever domain served the page.
 *
 * Returns 404 if the object hasn't been uploaded to this environment's
 * bucket yet — the browser just falls back (no custom icon; the BrandLogo
 * component renders its text fallback) rather than breaking.
 */
const FAVICON_KEY = 'favicon/favicon.png';
const BRAND_LOGO_KEY = 'logos/logo_small.png';

async function serveR2Png(env, key) {
  const object = await env.STORAGE.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get('content-type')) headers.set('Content-Type', 'image/png');
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(object.body, { headers });
}

export async function handleFaviconAsset(request, env) {
  return serveR2Png(env, FAVICON_KEY);
}

export async function handleBrandLogoAsset(request, env) {
  return serveR2Png(env, BRAND_LOGO_KEY);
}

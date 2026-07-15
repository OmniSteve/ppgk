/**
 * GET /api/assets/favicon.png
 *
 * Streams the site favicon from R2. This is deliberately a single fixed-key
 * route rather than a generic R2 proxy (see routes/store/images.js for why
 * arbitrary multi-segment R2 keys can't be captured as a single :param by
 * this app's exact-segment router) — it serves only this one object.
 *
 * Environment-aware for free: this route lives under the existing /api/*
 * Worker route (already active for both ppgk.app and dev.ppgk.app — no new
 * Cloudflare route pattern needed), and env.STORAGE already resolves to a
 * different R2 bucket per environment (ppgk-dev vs ppgk). The frontend calls
 * this via a relative "/api/assets/favicon.png" URL, so it automatically
 * hits the correct bucket for whichever domain served the page.
 *
 * Returns 404 if the object hasn't been uploaded to this environment's
 * bucket yet (e.g. production, until someone uploads it there) — the
 * browser just falls back to no custom icon rather than breaking.
 */
const FAVICON_KEY = 'favicon/favicon.png';

export async function handleFaviconAsset(request, env) {
  const object = await env.STORAGE.get(FAVICON_KEY);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get('content-type')) headers.set('Content-Type', 'image/png');
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(object.body, { headers });
}

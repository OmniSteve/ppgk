/**
 * GET /api/store/images/:id
 *
 * Streams a product image from R2, addressed by store_product_images.id
 * (an opaque single path segment) rather than the raw R2 key — the R2 key
 * itself contains slashes (e.g. "store/products/<productId>/<uuid>.jpg") for
 * storage organisation, and this app's router matches routes by exact
 * segment count (worker/src/lib/router.js), so a multi-segment key can't be
 * captured as a single `:param`. Looking the key up by row id sidesteps that
 * without needing a wildcard-route change.
 *
 * Product status is not checked here (admins need to preview draft-product
 * images too); the risk of an unpublished product's photo being guessable is
 * low, and the product's name/price/description stay hidden either way (the
 * public product routes only ever return active products).
 */
import { queryOne } from '../../lib/db.js';

export async function handleStoreImage(request, env, ctx, params) {
  const id = params?.id;
  if (!id) return new Response('Not found', { status: 404 });

  const row = await queryOne(env, 'SELECT r2_key FROM store_product_images WHERE id = ?', [id]);
  if (!row) return new Response('Not found', { status: 404 });

  const object = await env.STORAGE.get(row.r2_key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(object.body, { headers });
}

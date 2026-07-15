/**
 * Admin product image management (R2-backed).
 * POST   /api/admin/store/products/:id/images            — upload (multipart, field name "file")
 * PATCH  /api/admin/store/products/:id/images/:imageId    — set primary / reorder
 * DELETE /api/admin/store/products/:id/images/:imageId
 */
import { requireRole } from '../../../lib/auth.js';
import { queryOne, execute, audit } from '../../../lib/db.js';
import { toCamelArray } from '../../../lib/serializers.js';
import { query } from '../../../lib/db.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function handleAdminStoreImages(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const method = request.method;

  if (!params?.id) return Response.json({ message: 'Product id required' }, { status: 400 });
  const product = await queryOne(env, 'SELECT id FROM store_products WHERE id = ?', [params.id]);
  if (!product) return Response.json({ message: 'Product not found' }, { status: 404 });

  if (method === 'POST' && !params?.imageId) {
    let form;
    try { form = await request.formData(); } catch { return Response.json({ message: 'Expected multipart/form-data' }, { status: 400 }); }
    const file = form.get('file');
    if (!file || typeof file === 'string') return Response.json({ message: 'file is required' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return Response.json({ message: 'Only JPEG, PNG, or WEBP images are allowed' }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ message: 'Image must be 5MB or smaller' }, { status: 400 });

    const ext = EXT_BY_TYPE[file.type];
    const key = `store/products/${params.id}/${crypto.randomUUID()}.${ext}`;
    await env.STORAGE.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    const existingCount = await queryOne(env, 'SELECT COUNT(*) as c FROM store_product_images WHERE product_id = ?', [params.id]);
    const isFirst = (existingCount?.c ?? 0) === 0;
    const imageId = crypto.randomUUID();
    await execute(env,
      `INSERT INTO store_product_images (id, product_id, r2_key, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)`,
      [imageId, params.id, key, existingCount?.c ?? 0, isFirst ? 1 : 0]
    );
    if (isFirst) {
      await execute(env, 'UPDATE store_products SET primary_image_id = ? WHERE id = ?', [imageId, params.id]);
    }

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'store_product_image', recordId: imageId, description: `Image uploaded for product ${params.id}` });
    return Response.json({ id: imageId, url: `/api/store/images/${imageId}`, isPrimary: !!isFirst }, { status: 201 });
  }

  if (method === 'PATCH' && params?.imageId) {
    const body = await request.json().catch(() => ({}));
    if (body.isPrimary) {
      await execute(env, 'UPDATE store_product_images SET is_primary = 0 WHERE product_id = ?', [params.id]);
      await execute(env, 'UPDATE store_product_images SET is_primary = 1 WHERE id = ? AND product_id = ?', [params.imageId, params.id]);
      await execute(env, 'UPDATE store_products SET primary_image_id = ? WHERE id = ?', [params.imageId, params.id]);
    }
    if (body.sortOrder != null) {
      await execute(env, 'UPDATE store_product_images SET sort_order = ? WHERE id = ? AND product_id = ?', [body.sortOrder, params.imageId, params.id]);
    }
    return Response.json({ message: 'Image updated' });
  }

  if (method === 'DELETE' && params?.imageId) {
    const image = await queryOne(env, 'SELECT * FROM store_product_images WHERE id = ? AND product_id = ?', [params.imageId, params.id]);
    if (!image) return Response.json({ message: 'Image not found' }, { status: 404 });

    try { await env.STORAGE.delete(image.r2_key); } catch (e) { console.error('R2 delete failed (non-fatal):', e.message); }
    await execute(env, 'DELETE FROM store_product_images WHERE id = ?', [params.imageId]);

    if (image.is_primary) {
      const next = await queryOne(env, 'SELECT id FROM store_product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1', [params.id]);
      await execute(env, 'UPDATE store_products SET primary_image_id = ? WHERE id = ?', [next?.id ?? null, params.id]);
      if (next) await execute(env, 'UPDATE store_product_images SET is_primary = 1 WHERE id = ?', [next.id]);
    }

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'delete', recordType: 'store_product_image', recordId: params.imageId, description: `Image deleted from product ${params.id}` });
    return Response.json({ message: 'Image deleted' });
  }

  if (method === 'GET' && !params?.imageId) {
    const rows = await query(env, 'SELECT * FROM store_product_images WHERE product_id = ? ORDER BY sort_order', [params.id]);
    return Response.json({ images: toCamelArray(rows).map((img) => ({ ...img, url: `/api/store/images/${img.id}` })) });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}

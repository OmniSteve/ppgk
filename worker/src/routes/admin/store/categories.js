/**
 * Admin category management.
 * GET    /api/admin/store/categories
 * POST   /api/admin/store/categories
 * PATCH  /api/admin/store/categories/:id
 * GET    /api/admin/store/categories/:id/deletion-eligibility
 * DELETE /api/admin/store/categories/:id
 */
import { requireRole } from '../../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../../lib/db.js';
import { toCamelArray } from '../../../lib/serializers.js';
import { uniqueSlug } from '../../../lib/slug.js';

export async function handleAdminStoreCategories(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const url = new URL(request.url);
  const method = request.method;

  if (params?.id && url.pathname.endsWith('/deletion-eligibility') && method === 'GET') {
    const row = await queryOne(env, 'SELECT COUNT(*) as c FROM store_products WHERE category_id = ?', [params.id]);
    const count = row?.c ?? 0;
    return Response.json({
      eligible: count === 0,
      blockingReasons: count > 0 ? [`${count} product(s) use this category`] : [],
      dependencyCounts: { products: count },
    });
  }

  if (params?.id && method === 'DELETE') {
    const category = await queryOne(env, 'SELECT id, name FROM store_categories WHERE id = ?', [params.id]);
    if (!category) return Response.json({ message: 'Category not found' }, { status: 404 });
    const dependents = await queryOne(env, 'SELECT COUNT(*) as c FROM store_products WHERE category_id = ?', [params.id]);
    if ((dependents?.c ?? 0) > 0) {
      return Response.json({ message: 'This category has products assigned — reassign or archive them first' }, { status: 409 });
    }
    await execute(env, 'DELETE FROM store_categories WHERE id = ?', [params.id]);
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'delete', recordType: 'store_category', recordId: params.id, description: `Category deleted: ${category.name}` });
    return Response.json({ message: 'Category deleted' });
  }

  if (method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.name) return Response.json({ message: 'name is required' }, { status: 400 });
    const slug = await uniqueSlug(body.slug || body.name, async (s) => !!(await queryOne(env, 'SELECT id FROM store_categories WHERE slug = ?', [s])));
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO store_categories (id, name, slug, description, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, body.name, slug, body.description ?? null, body.sortOrder ?? 0, body.active === false ? 0 : 1]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'store_category', recordId: id, description: `Category created: ${body.name}` });
    return Response.json({ id, slug }, { status: 201 });
  }

  if (params?.id && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    let slug;
    if (body.slug || body.name) {
      slug = await uniqueSlug(body.slug || body.name, async (s) => {
        const row = await queryOne(env, 'SELECT id FROM store_categories WHERE slug = ? AND id != ?', [s, params.id]);
        return !!row;
      });
    }
    await execute(env,
      `UPDATE store_categories SET name = COALESCE(?, name), slug = COALESCE(?, slug), description = COALESCE(?, description),
         sort_order = COALESCE(?, sort_order), active = COALESCE(?, active), updated_at = ? WHERE id = ?`,
      [body.name ?? null, slug ?? null, body.description ?? null, body.sortOrder ?? null,
       body.active != null ? (body.active ? 1 : 0) : null, new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'store_category', recordId: params.id, description: `Category updated: ${params.id}` });
    return Response.json({ message: 'Category updated' });
  }

  const rows = await query(env, 'SELECT * FROM store_categories ORDER BY sort_order, name', []);
  return Response.json({ categories: toCamelArray(rows) });
}

/** Client package endpoints */
import { requireAuth } from '../../lib/auth.js';
import { query } from '../../lib/db.js';

export async function handleClientPackages(request, env, ctx, params) {
  await requireAuth(request, env);

  if (request.method === 'GET') {
    const packages = await query(env, "SELECT * FROM package_definitions WHERE active = 1 ORDER BY price", []);
    return Response.json({ packages });
  }

  if (request.method === 'POST' && params?.id) {
    // POST /api/packages/:id/purchase — initiate Stripe checkout for package purchase
    // TODO: Create Stripe checkout session and return URL
    return Response.json({ message: 'Package purchase initiation — Stripe integration pending', checkoutUrl: null }, { status: 501 });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
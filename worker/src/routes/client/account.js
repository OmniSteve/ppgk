/** GET/PUT /api/account */
import { requireAuth } from '../../lib/auth.js';
import { queryOne, execute } from '../../lib/db.js';
import { toCamel } from '../../lib/serializers.js';

async function fetchAccount(env, userId) {
  return await queryOne(env,
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
            cp.address_line1, cp.city, cp.post_code,
            cp.emergency_contact_name, cp.emergency_contact_phone, cp.emergency_contact_relation
     FROM users u LEFT JOIN client_profiles cp ON cp.user_id = u.id WHERE u.id = ?`,
    [userId]
  );
}

export async function handleClientAccount(request, env) {
  const payload = await requireAuth(request, env);

  if (request.method === 'GET') {
    const user = await fetchAccount(env, payload.sub);
    if (!user) return Response.json({ message: 'Account not found' }, { status: 404 });
    return Response.json(toCamel(user));
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const now  = new Date().toISOString();
    await execute(env,
      'UPDATE users SET first_name=?, last_name=?, phone=?, updated_at=? WHERE id=?',
      [body.firstName ?? null, body.lastName ?? null, body.phone ?? null, now, payload.sub]
    );
    await execute(env,
      `UPDATE client_profiles SET address_line1=?, city=?, post_code=?, emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relation=?, updated_at=? WHERE user_id=?`,
      [body.addressLine1 ?? null, body.city ?? null, body.postCode ?? null, body.emergencyContactName ?? null, body.emergencyContactPhone ?? null, body.emergencyContactRelation ?? null, now, payload.sub]
    );
    const updated = await fetchAccount(env, payload.sub);
    return Response.json(toCamel(updated));
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
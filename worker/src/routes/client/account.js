/** GET/PUT /api/account */
import { requireAuth } from '../../lib/auth.js';
import { queryOne, execute } from '../../lib/db.js';

export async function handleClientAccount(request, env) {
  const payload = await requireAuth(request, env);

  if (request.method === 'GET') {
    const user = await queryOne(env,
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
              cp.address_line1, cp.city, cp.post_code, cp.emergency_contact_name, cp.emergency_contact_phone, cp.emergency_contact_relation
       FROM users u LEFT JOIN client_profiles cp ON cp.user_id = u.id WHERE u.id = ?`,
      [payload.sub]
    );
    return Response.json(user);
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const now  = new Date().toISOString();
    await execute(env,
      'UPDATE users SET first_name=?, last_name=?, phone=?, updated_at=? WHERE id=?',
      [body.firstName, body.lastName, body.phone ?? null, now, payload.sub]
    );
    await execute(env,
      `UPDATE client_profiles SET address_line1=?, city=?, post_code=?, emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relation=?, updated_at=? WHERE user_id=?`,
      [body.addressLine1 ?? null, body.city ?? null, body.postCode ?? null, body.emergencyContactName ?? null, body.emergencyContactPhone ?? null, body.emergencyContactRelation ?? null, now, payload.sub]
    );
    return Response.json({ message: 'Account updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
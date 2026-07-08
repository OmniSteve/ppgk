/** Client player management */
import { requireAuth } from '../../lib/auth.js';
import { query, queryOne, execute } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';

export async function handleClientPlayers(request, env, ctx, params) {
  const payload = await requireAuth(request, env);
  const method  = request.method;

  if (method === 'GET' && !params?.id) {
    const players = await query(env, 'SELECT * FROM players WHERE client_id = ? ORDER BY first_name', [payload.sub]);
    return Response.json({ players: toCamelArray(players) });
  }

  if (method === 'GET' && params?.id) {
    const player = await queryOne(env, 'SELECT * FROM players WHERE id = ? AND client_id = ?', [params.id, payload.sub]);
    if (!player) return Response.json({ message: 'Player not found' }, { status: 404 });
    return Response.json(toCamel(player));
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body.firstName || !body.lastName) return Response.json({ message: 'firstName and lastName required' }, { status: 400 });
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO players (id, client_id, first_name, last_name, date_of_birth, age_group, experience_level, current_club, medical_info, allergies, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, payload.sub, body.firstName, body.lastName, body.dateOfBirth ?? null, body.ageGroup ?? null,
       body.experienceLevel ?? null, body.currentClub ?? null, body.medicalInfo ?? null,
       body.allergies ?? null, body.emergencyContactName ?? null, body.emergencyContactPhone ?? null,
       body.emergencyContactRelationship ?? null, body.notes ?? null]
    );
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    const existing = await queryOne(env, 'SELECT id FROM players WHERE id = ? AND client_id = ?', [params.id, payload.sub]);
    if (!existing) return Response.json({ message: 'Player not found' }, { status: 404 });
    await execute(env,
      `UPDATE players SET first_name=?, last_name=?, date_of_birth=?, age_group=?, experience_level=?, current_club=?, medical_info=?, allergies=?, emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relationship=?, notes=?, updated_at=? WHERE id=?`,
      [body.firstName, body.lastName, body.dateOfBirth ?? null, body.ageGroup ?? null, body.experienceLevel ?? null,
       body.currentClub ?? null, body.medicalInfo ?? null, body.allergies ?? null,
       body.emergencyContactName ?? null, body.emergencyContactPhone ?? null,
       body.emergencyContactRelationship ?? null, body.notes ?? null,
       new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
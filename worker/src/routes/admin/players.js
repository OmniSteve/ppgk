/** GET /api/admin/players, PATCH /api/admin/players/:id */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';

export async function handleAdminPlayers(request, env, ctx, params) {
  await requireRole(request, env, 'admin', 'head_coach', 'coach');

  // ── PATCH /api/admin/players/:id ────────────────────────────────────────────
  if (request.method === 'PATCH' && params?.id) {
    const body = await request.json().catch(() => ({}));
    const now  = new Date().toISOString();
    const { firstName, lastName, dateOfBirth, ageGroup, experienceLevel,
            currentClub, school, medicalInfo, allergies,
            emergencyContactName, emergencyContactPhone, emergencyContactRelationship, notes, status } = body;

    await execute(env,
      `UPDATE players SET
         first_name = COALESCE(?, first_name),
         last_name  = COALESCE(?, last_name),
         date_of_birth = COALESCE(?, date_of_birth),
         age_group  = COALESCE(?, age_group),
         experience_level = COALESCE(?, experience_level),
         current_club = COALESCE(?, current_club),
         school     = COALESCE(?, school),
         medical_info = COALESCE(?, medical_info),
         allergies  = COALESCE(?, allergies),
         emergency_contact_name  = COALESCE(?, emergency_contact_name),
         emergency_contact_phone = COALESCE(?, emergency_contact_phone),
         emergency_contact_relationship = COALESCE(?, emergency_contact_relationship),
         notes      = COALESCE(?, notes),
         status     = COALESCE(?, status),
         updated_at = ?
       WHERE id = ?`,
      [firstName ?? null, lastName ?? null, dateOfBirth ?? null,
       ageGroup ?? null, experienceLevel ?? null, currentClub ?? null,
       school ?? null, medicalInfo ?? null, allergies ?? null,
       emergencyContactName ?? null, emergencyContactPhone ?? null,
       emergencyContactRelationship ?? null,
       notes ?? null, status ?? null,
       now, params.id]
    );

    const updated = await queryOne(env,
      `SELECT p.*, u.first_name || ' ' || u.last_name as parent_name
       FROM players p JOIN users u ON u.id = p.client_id WHERE p.id = ?`,
      [params.id]
    );
    return Response.json(toCamel(updated));
  }

  // ── GET /api/admin/players ──────────────────────────────────────────────────
  const url    = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const page   = parseInt(url.searchParams.get('page') || '1');
  const limit  = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  const like   = `%${search}%`;

  const [players, countRow] = await Promise.all([
    query(env,
      `SELECT p.*, u.first_name || ' ' || u.last_name as parent_name
       FROM players p JOIN users u ON u.id = p.client_id
       WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.current_club LIKE ? OR u.first_name LIKE ?
       ORDER BY p.first_name LIMIT ? OFFSET ?`,
      [like, like, like, like, limit, offset]
    ),
    queryOne(env,
      `SELECT COUNT(*) as count FROM players p JOIN users u ON u.id = p.client_id
       WHERE p.first_name LIKE ? OR p.last_name LIKE ? OR p.current_club LIKE ? OR u.first_name LIKE ?`,
      [like, like, like, like]
    ),
  ]);

  return Response.json({ players: toCamelArray(players), total: countRow?.count ?? 0 });
}
/** GET /api/admin/players */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';

export async function handleAdminPlayers(request, env, ctx, params) {
  await requireRole(request, env, 'admin', 'head_coach', 'coach');
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

  return Response.json({
    players: players.map((p) => ({
      id:              p.id,
      firstName:       p.first_name,
      lastName:        p.last_name,
      dateOfBirth:     p.date_of_birth,
      ageGroup:        p.age_group,
      experienceLevel: p.experience_level,
      currentClub:     p.current_club,
      school:          p.school,
      medicalInfo:     p.medical_info,
      allergies:       p.allergies,
      status:          p.status,
      notes:           p.notes,
      parentName:      p.parent_name,
    })),
    total: countRow?.count ?? 0,
  });
}
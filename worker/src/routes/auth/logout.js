/**
 * POST /api/auth/logout
 *
 * Stateless JWT — just acknowledge. Client discards the token.
 * If refresh tokens are stored, invalidate them here.
 */
import { requireAuth } from '../../lib/auth.js';
import { execute, audit } from '../../lib/db.js';

export async function handleLogout(request, env) {
  try {
    const payload = await requireAuth(request, env);
    // Optionally clear refresh token from DB
    await execute(env, 'UPDATE users SET refresh_token = NULL WHERE id = ?', [payload.sub]);
    await audit(env, {
      actorId: payload.sub, actorName: `${payload.firstName} ${payload.lastName}`,
      action: 'logout', recordType: 'user', recordId: payload.sub,
      description: `User signed out: ${payload.email}`,
    });
  } catch {
    // Token may already be expired — still return 200
  }
  return Response.json({ message: 'Signed out' });
}
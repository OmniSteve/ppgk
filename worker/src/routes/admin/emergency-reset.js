/**
 * POST /api/admin/emergency-reset
 * TEMPORARY — remove after admin account is recovered.
 *
 * Body: { secret, userId, newPassword }
 *
 * `secret` must match env.EMERGENCY_RESET_SECRET (set in wrangler.toml or dashboard).
 * Resets the password_hash AND marks email_verified = 1 for the given user.
 */
import { execute, queryOne } from '../../lib/db.js';
import { hashPassword }      from '../../lib/password.js';
import { corsHeaders }       from '../../lib/cors.js';

export async function handleEmergencyReset(request, env) {
  // Only active when the env var is explicitly set
  if (!env.EMERGENCY_RESET_SECRET) {
    return Response.json({ error: 'Not enabled' }, { status: 404 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { secret, userId, newPassword } = body;

  if (!secret || secret !== env.EMERGENCY_RESET_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!userId || !newPassword) {
    return Response.json({ error: 'userId and newPassword required' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const user = await queryOne(env, 'SELECT id, email, role FROM users WHERE id = ?', [userId]);
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);

  await execute(env,
    'UPDATE users SET password_hash = ?, email_verified = 1, email_verify_token = NULL WHERE id = ?',
    [passwordHash, userId]
  );

  return Response.json({
    success: true,
    userId: user.id,
    email: user.email,
    role: user.role,
    message: 'Password reset and email verified. Remove this endpoint now.',
  }, { status: 200, headers: corsHeaders(request) });
}
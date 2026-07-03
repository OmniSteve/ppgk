/**
 * POST /api/admin/emergency-reset
 * TEMPORARY — remove after admin account is recovered.
 *
 * Body: { secret, email, newPassword }
 *   OR: { secret, userId, newPassword }
 *
 * `secret` must match env.EMERGENCY_RESET_SECRET (set in Cloudflare dashboard env vars).
 * Resets the password_hash AND marks email_verified = 1 for the matched user.
 */
import { execute, queryOne } from '../../lib/db.js';
import { hashPassword }      from '../../lib/password.js';
import { corsHeaders }       from '../../lib/cors.js';

export async function handleEmergencyReset(request, env) {
  // Only active when the env var is explicitly set
  if (!env.EMERGENCY_RESET_SECRET) {
    return Response.json({ error: 'Not enabled — set EMERGENCY_RESET_SECRET env var' }, { status: 404 });
  }

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { secret, userId, email, newPassword } = body;

  if (!secret || secret !== env.EMERGENCY_RESET_SECRET) {
    return Response.json({ error: 'Forbidden — wrong secret' }, { status: 403 });
  }
  if (!newPassword || newPassword.length < 8) {
    return Response.json({ error: 'newPassword must be at least 8 characters' }, { status: 400 });
  }
  if (!userId && !email) {
    return Response.json({ error: 'Provide either userId or email' }, { status: 400 });
  }

  // Look up by email OR userId
  const user = email
    ? await queryOne(env, 'SELECT id, email, role, password_hash, email_verified FROM users WHERE email = ?', [email.toLowerCase()])
    : await queryOne(env, 'SELECT id, email, role, password_hash, email_verified FROM users WHERE id = ?', [userId]);

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);

  await execute(env,
    'UPDATE users SET password_hash = ?, email_verified = 1, email_verify_token = NULL WHERE id = ?',
    [passwordHash, user.id]
  );

  // Re-fetch to confirm the write landed
  const updated = await queryOne(env, 'SELECT password_hash, email_verified FROM users WHERE id = ?', [user.id]);

  return Response.json({
    success: true,
    userId: user.id,
    email: user.email,
    role: user.role,
    wasVerified: user.email_verified === 1,
    oldHashPrefix: user.password_hash ? user.password_hash.substring(0, 12) + '...' : null,
    newHashPrefix: updated?.password_hash ? updated.password_hash.substring(0, 12) + '...' : null,
    newHashVerified: updated?.email_verified === 1,
    hashesMatch: updated?.password_hash === passwordHash,
    message: 'Password reset and email verified. You can now sign in. Remove EMERGENCY_RESET_SECRET when done.',
  }, { status: 200, headers: corsHeaders(request) });
}
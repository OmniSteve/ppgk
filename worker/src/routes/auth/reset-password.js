/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 */
import { queryOne, execute, audit } from '../../lib/db.js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex    = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const derivedHex = Array.from(new Uint8Array(derived)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${derivedHex}`;
}

export async function handleResetPassword(request, env) {
  const body = await request.json();
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return Response.json({ message: 'token and newPassword are required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return Response.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const user = await queryOne(env,
    `SELECT id, first_name, last_name, email, reset_token_expires
     FROM users WHERE reset_token = ?`,
    [token]
  );

  if (!user) {
    return Response.json({ message: 'Invalid or expired reset token' }, { status: 400 });
  }

  if (new Date(user.reset_token_expires) < new Date()) {
    return Response.json({ message: 'Reset token has expired. Please request a new one.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await execute(env,
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [passwordHash, user.id]
  );

  await audit(env, {
    actorId: user.id, actorName: `${user.first_name} ${user.last_name}`,
    action: 'update', recordType: 'user', recordId: user.id,
    description: `Password reset for ${user.email}`,
  });

  return Response.json({ message: 'Password updated successfully. You can now sign in.' });
}
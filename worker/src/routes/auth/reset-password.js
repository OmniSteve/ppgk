/**
 * POST /api/auth/reset-password
 *
 * Body: { token, newPassword }
 */
import { queryOne, execute, audit } from '../../lib/db.js';
import { hashPassword }             from '../../lib/password.js';

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
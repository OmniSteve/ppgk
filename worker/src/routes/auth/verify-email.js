/**
 * POST /api/auth/verify-email
 *
 * Body: { token }
 * Marks the user's email as verified.
 */
import { queryOne, execute, audit } from '../../lib/db.js';

export async function handleVerifyEmail(request, env) {
  const body = await request.json();
  const { token } = body;

  if (!token) {
    return Response.json({ message: 'token is required' }, { status: 400 });
  }

  const user = await queryOne(env, 'SELECT id, first_name, last_name, email FROM users WHERE email_verify_token = ?', [token]);

  if (!user) {
    return Response.json({ message: 'Invalid or already used verification token' }, { status: 400 });
  }

  await execute(env,
    'UPDATE users SET email_verified = 1, email_verify_token = NULL WHERE id = ?',
    [user.id]
  );

  await audit(env, {
    actorId: user.id, actorName: `${user.first_name} ${user.last_name}`,
    action: 'update', recordType: 'user', recordId: user.id,
    description: `Email verified: ${user.email}`,
  });

  return Response.json({ message: 'Email verified successfully. You can now sign in.' });
}
/**
 * GET /api/auth/me
 *
 * Returns current authenticated user profile.
 */
import { requireAuth } from '../../lib/auth.js';
import { queryOne } from '../../lib/db.js';

export async function handleMe(request, env) {
  const payload = await requireAuth(request, env);

  const user = await queryOne(env,
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.phone, u.email_verified, u.last_login_at,
            cp.address_line1, cp.city, cp.post_code, cp.emergency_contact_name, cp.emergency_contact_phone, cp.gdpr_consent
     FROM users u
     LEFT JOIN client_profiles cp ON cp.user_id = u.id
     WHERE u.id = ? AND u.active = 1`,
    [payload.sub]
  );

  if (!user) {
    return Response.json({ message: 'User not found' }, { status: 404 });
  }

  return Response.json({
    id:                   user.id,
    email:                user.email,
    firstName:            user.first_name,
    lastName:             user.last_name,
    role:                 user.role,
    phone:                user.phone,
    emailVerified:        !!user.email_verified,
    lastLoginAt:          user.last_login_at,
    addressLine1:         user.address_line1,
    city:                 user.city,
    postCode:             user.post_code,
    emergencyContactName: user.emergency_contact_name,
    emergencyContactPhone:user.emergency_contact_phone,
    gdprConsent:          !!user.gdpr_consent,
  });
}
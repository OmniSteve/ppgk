/**
 * POST /api/auth/refresh
 *
 * Body: { refreshToken }
 * Currently a stub — implement if you adopt refresh token rotation.
 * For now the app uses 24h access tokens only.
 */
export async function handleRefreshToken(request, env) {
  return Response.json({ message: 'Refresh tokens not yet implemented. Please sign in again.' }, { status: 501 });
}
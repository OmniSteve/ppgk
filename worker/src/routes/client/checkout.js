/**
 * POST /api/checkout
 * Initiates a Stripe Checkout session for one or more sessions or a package.
 * TODO: Implement Stripe integration using env.STRIPE_SECRET.
 */
import { requireAuth } from '../../lib/auth.js';

export async function handleCheckout(request, env) {
  await requireAuth(request, env);
  // STUB — Stripe integration pending
  return Response.json({ message: 'Checkout via Stripe — integration pending', checkoutUrl: null }, { status: 501 });
}
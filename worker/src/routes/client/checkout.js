/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout Session for an existing pending order.
 * Prices are fetched server-side from D1 — never trusted from the frontend.
 *
 * Body: { orderId }
 */
import { requireAuth }              from '../../lib/auth.js';
import { queryOne, query, execute } from '../../lib/db.js';
import { err, ok }                  from '../../lib/validate.js';

export async function handleCheckout(request, env, ctx, params) {
  const payload = await requireAuth(request, env);

  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const { orderId } = body;
  if (!orderId) return err('orderId is required');

  if (!env.STRIPE_SECRET) {
    return err('Payment processing is not configured', 503);
  }

  // Verify order belongs to this client and is pending
  const order = await queryOne(env,
    "SELECT * FROM orders WHERE id = ? AND client_id = ? AND status = 'pending'",
    [orderId, payload.sub]
  );
  if (!order) return err('Order not found or not in pending state', 404);

  // If we already created a Stripe session for this order, return it
  if (order.stripe_session_id) {
    return ok({ checkoutUrl: `https://checkout.stripe.com/pay/${order.stripe_session_id}`, existing: true });
  }

  // Load order items — prices from D1, not from request
  const items    = await query(env, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  const lineItems = [];
  let totalAmount = 0;

  for (const item of items) {
    if (item.item_type === 'session_booking') {
      const session = await queryOne(env, 'SELECT title, price FROM sessions WHERE id = ?', [item.session_id]);
      if (!session || !session.price) continue;
      lineItems.push({
        price_data: {
          currency:     'eur',
          unit_amount:  Math.round(session.price * 100),
          product_data: { name: session.title },
        },
        quantity: 1,
      });
      totalAmount += session.price;
    } else if (item.item_type === 'package_purchase') {
      const pkg = await queryOne(env, 'SELECT name, price FROM package_definitions WHERE id = ?', [item.package_definition_id]);
      if (!pkg) continue;
      lineItems.push({
        price_data: {
          currency:     'eur',
          unit_amount:  Math.round(pkg.price * 100),
          product_data: { name: `${pkg.name} (credit package)` },
        },
        quantity: 1,
      });
      totalAmount += pkg.price;
    }
  }

  if (lineItems.length === 0) return err('No valid line items for this order');

  // Update order total with server-computed amount
  await execute(env, 'UPDATE orders SET total_amount=? WHERE id=?', [totalAmount, orderId]);

  const appUrl = env.APP_URL || 'https://premierperformancegk.com';

  // Create Stripe Checkout Session
  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode:                          'payment',
      'line_items[0][price_data][currency]':                    lineItems[0].price_data.currency,
      'line_items[0][price_data][unit_amount]':                 String(lineItems[0].price_data.unit_amount),
      'line_items[0][price_data][product_data][name]':          lineItems[0].price_data.product_data.name,
      'line_items[0][quantity]':                                '1',
      // Full line_items building via URLSearchParams for multiple items
      success_url: `${appUrl}/payment/result?status=success&orderId=${orderId}`,
      cancel_url:  `${appUrl}/payment/result?status=cancelled&orderId=${orderId}`,
      'metadata[orderId]':           orderId,
      'payment_intent_data[metadata][orderId]': orderId,
      ...(payload.email ? { customer_email: payload.email } : {}),
    }).toString(),
  });

  if (!stripeRes.ok) {
    const stripeErr = await stripeRes.json();
    console.error('Stripe session creation failed:', stripeErr);
    return err('Failed to create payment session. Please try again.', 502);
  }

  const stripeSession = await stripeRes.json();
  await execute(env,
    'UPDATE orders SET stripe_session_id=?, updated_at=? WHERE id=?',
    [stripeSession.id, new Date().toISOString(), orderId]
  );

  return ok({ checkoutUrl: stripeSession.url, sessionId: stripeSession.id });
}
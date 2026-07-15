/**
 * Public store order creation + Stripe Checkout Session creation.
 * POST /api/store/orders     — validate cart server-side, create a pending order + reservations
 * POST /api/store/checkout   — create the Stripe Checkout Session for a pending order
 *
 * Guests and authenticated customers share this exact code path (tryAuth is
 * optional — see lib/auth.js). Every price, the delivery fee, and stock
 * availability are always re-derived from D1, never trusted from the client,
 * matching the pattern already established in client/checkout.js.
 */
import { tryAuth } from '../../lib/auth.js';
import { query, queryOne, execute } from '../../lib/db.js';
import { ok, err } from '../../lib/validate.js';
import {
  getStoreSettings, nextOrderNumber, computeDeliveryFee, computeTax,
  effectiveUnitPrice, reserveStockForItems, releaseReservationsForOrder,
} from '../../lib/store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadCartLines(env, items) {
  const lines = [];
  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { error: 'Each cart item needs a productId and a positive integer quantity' };
    }
    const product = await queryOne(env, "SELECT * FROM store_products WHERE id = ? AND status = 'active'", [item.productId]);
    if (!product) return { error: `Product ${item.productId} is not available` };

    let variant = null;
    if (item.variantId) {
      variant = await queryOne(env, 'SELECT * FROM store_product_variants WHERE id = ? AND product_id = ? AND active = 1', [item.variantId, item.productId]);
      if (!variant) return { error: `The selected variant for ${product.name} is not available` };
    } else {
      const hasVariants = await queryOne(env, 'SELECT 1 FROM store_product_variants WHERE product_id = ? AND active = 1 LIMIT 1', [product.id]);
      if (hasVariants) return { error: `${product.name} requires selecting a size/colour` };
    }

    const available = variant ? variant.stock_qty - variant.reserved_qty : (product.track_stock ? product.stock_qty - product.reserved_qty : Infinity);
    if (product.track_stock && available < item.quantity) {
      return { error: `Only ${Math.max(0, available)} of ${product.name}${variant ? ` (${variant.name})` : ''} left in stock` };
    }

    const unitPrice = effectiveUnitPrice(product, variant);
    lines.push({
      productId: product.id, variantId: variant?.id ?? null,
      productName: product.name, variantDetails: variant?.name ?? null, sku: variant?.sku ?? product.sku ?? null,
      unitPrice, quantity: item.quantity, lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    });
  }
  return { lines };
}

export async function handleStoreCheckout(request, env, ctx, params) {
  const url = new URL(request.url);

  // ── POST /api/store/orders ──────────────────────────────────────────────
  if (request.method === 'POST' && url.pathname.endsWith('/orders')) {
    const payload = await tryAuth(request, env);
    const body = await request.json().catch(() => ({}));
    const { items, customerName, customerEmail, customerPhone, deliveryMethod, deliveryAddressLine1, deliveryAddressLine2, deliveryCity, deliveryPostCode, notes } = body;

    if (!Array.isArray(items) || items.length === 0) return err('Your cart is empty');
    if (!customerName || !customerEmail || !customerPhone) return err('Name, email and phone are required');
    if (!EMAIL_RE.test(customerEmail)) return err('Enter a valid email address');
    if (!['collection', 'delivery'].includes(deliveryMethod)) return err('deliveryMethod must be collection or delivery');

    const settings = await getStoreSettings(env);
    if (!settings.store_enabled) return err('The store is currently unavailable', 503);
    if (deliveryMethod === 'delivery' && !settings.delivery_enabled) return err('Delivery is not currently available — please choose collection');
    if (deliveryMethod === 'collection' && !settings.collection_enabled) return err('Collection is not currently available — please choose delivery');
    if (deliveryMethod === 'delivery' && (!deliveryAddressLine1 || !deliveryCity || !deliveryPostCode)) {
      return err('A full delivery address is required');
    }

    const { lines, error: lineError } = await loadCartLines(env, items);
    if (lineError) return err(lineError);

    const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
    const deliveryFee = computeDeliveryFee(settings, deliveryMethod, subtotal);
    const { taxAmount, taxMode } = computeTax(settings, subtotal);
    const total = Math.round((subtotal + deliveryFee + taxAmount) * 100) / 100;

    const orderId = crypto.randomUUID();
    const orderNumber = await nextOrderNumber(env);
    const guestToken = payload ? null : crypto.randomUUID();
    const collectionSnapshot = deliveryMethod === 'collection' ? JSON.stringify({
      locationName: settings.collection_location_name, address: settings.collection_address,
      mapLink: settings.collection_map_link, instructions: settings.collection_instructions, hours: settings.collection_hours,
    }) : null;

    await execute(env,
      `INSERT INTO store_orders (
         id, order_number, user_id, guest_token, customer_name, customer_email, customer_phone,
         delivery_method, delivery_address_line1, delivery_address_line2, delivery_city, delivery_post_code,
         collection_snapshot, notes, subtotal, delivery_fee, tax_amount, tax_mode_snapshot, total, currency
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderNumber, payload?.sub ?? null, guestToken, customerName, customerEmail.toLowerCase(), customerPhone,
       deliveryMethod, deliveryAddressLine1 ?? null, deliveryAddressLine2 ?? null, deliveryCity ?? null, deliveryPostCode ?? null,
       collectionSnapshot, notes ?? null, subtotal, deliveryFee, taxAmount, taxMode, total, settings.store_currency || 'EUR']
    );
    for (const line of lines) {
      await execute(env,
        `INSERT INTO store_order_items (id, order_id, product_id, variant_id, product_name_snapshot, variant_details_snapshot, sku_snapshot, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), orderId, line.productId, line.variantId, line.productName, line.variantDetails, line.sku, line.unitPrice, line.quantity, line.lineTotal]
      );
    }

    const reservation = await reserveStockForItems(env, orderId, lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })));
    if (!reservation.success) {
      await execute(env, 'DELETE FROM store_orders WHERE id = ?', [orderId]); // cascades order_items
      return err('One of the items in your cart just sold out — please update your cart and try again', 409);
    }

    return ok({ orderId, orderNumber, total, guestToken }, 201);
  }

  // ── POST /api/store/checkout ─────────────────────────────────────────────
  if (request.method === 'POST' && url.pathname.endsWith('/checkout')) {
    const body = await request.json().catch(() => ({}));
    const { orderId } = body;
    if (!orderId) return err('orderId is required');

    if (!env.STRIPE_SECRET) return err('Payment processing is not configured', 503);

    const order = await queryOne(env, "SELECT * FROM store_orders WHERE id = ? AND payment_status = 'pending'", [orderId]);
    if (!order) return err('Order not found or not in a payable state', 404);

    if (order.stripe_session_id && order.stripe_checkout_url) {
      return ok({ checkoutUrl: order.stripe_checkout_url, existing: true });
    }

    const items = await query(env, 'SELECT * FROM store_order_items WHERE order_id = ?', [orderId]);
    const lineItems = items.map((i) => ({
      price_data: {
        currency: (order.currency || 'EUR').toLowerCase(),
        unit_amount: Math.round(i.unit_price * 100),
        product_data: { name: `${i.product_name_snapshot}${i.variant_details_snapshot ? ` — ${i.variant_details_snapshot}` : ''}` },
      },
      quantity: i.quantity,
    }));
    if (order.delivery_fee > 0) {
      lineItems.push({
        price_data: { currency: (order.currency || 'EUR').toLowerCase(), unit_amount: Math.round(order.delivery_fee * 100), product_data: { name: 'Delivery' } },
        quantity: 1,
      });
    }

    const appUrl = env.APP_URL || 'https://premierperformancegk.com';
    const formData = new URLSearchParams();
    formData.set('mode', 'payment');
    formData.set('success_url', `${appUrl}/shop/order-success?orderId=${orderId}`);
    formData.set('cancel_url', `${appUrl}/cart`);
    formData.set('metadata[payment_type]', 'store_order');
    formData.set('metadata[store_order_id]', orderId);
    formData.set('metadata[customer_type]', order.user_id ? 'registered' : 'guest');
    formData.set('payment_intent_data[metadata][payment_type]', 'store_order');
    formData.set('payment_intent_data[metadata][store_order_id]', orderId);
    formData.set('customer_email', order.customer_email);
    lineItems.forEach((item, i) => {
      formData.set(`line_items[${i}][price_data][currency]`, item.price_data.currency);
      formData.set(`line_items[${i}][price_data][unit_amount]`, String(item.price_data.unit_amount));
      formData.set(`line_items[${i}][price_data][product_data][name]`, item.price_data.product_data.name);
      formData.set(`line_items[${i}][quantity]`, String(item.quantity));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    if (!stripeRes.ok) {
      const stripeErr = await stripeRes.json();
      console.error('Store Stripe session creation failed:', stripeErr);
      return err('Failed to create payment session. Please try again.', 502);
    }
    const stripeSession = await stripeRes.json();
    await execute(env, 'UPDATE store_orders SET stripe_session_id = ?, stripe_checkout_url = ?, updated_at = ? WHERE id = ?',
      [stripeSession.id, stripeSession.url, new Date().toISOString(), orderId]);

    return ok({ checkoutUrl: stripeSession.url, sessionId: stripeSession.id });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}

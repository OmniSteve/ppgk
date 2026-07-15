/**
 * Store order email helper — thin wrapper around lib/email.js's
 * sendTemplatedEmail for the store_* event triggers seeded in migration
 * 0008. Never throws (matches the non-fatal try/catch pattern used at every
 * other sendTemplatedEmail call site in this codebase, e.g. bookings.js)
 * since a failed email must never block order fulfilment.
 */
import { query, queryOne } from './db.js';
import { sendTemplatedEmail } from './email.js';

function formatMoney(env, amount) {
  return `€${Number(amount ?? 0).toFixed(2)}`;
}

async function itemsSummary(env, orderId) {
  const items = await query(env, 'SELECT product_name_snapshot, variant_details_snapshot, quantity, line_total FROM store_order_items WHERE order_id = ?', [orderId]);
  return items.map((i) => `${i.quantity} x ${i.product_name_snapshot}${i.variant_details_snapshot ? ` (${i.variant_details_snapshot})` : ''} — ${formatMoney(env, i.line_total)}`).join('<br>');
}

function collectionNote(order) {
  if (order.delivery_method !== 'collection') return "We'll email you once it's dispatched.";
  let snapshot = {};
  try { snapshot = order.collection_snapshot ? JSON.parse(order.collection_snapshot) : {}; } catch { /* ignore malformed snapshot */ }
  const parts = ["We'll email you when it's ready for collection."];
  if (snapshot.locationName) parts.push(`Collect from: ${snapshot.locationName}.`);
  if (snapshot.address) parts.push(snapshot.address + '.');
  if (snapshot.instructions) parts.push(snapshot.instructions);
  if (snapshot.hours) parts.push(`Opening hours: ${snapshot.hours}.`);
  return parts.join(' ');
}

export async function sendStoreCustomerEmail(env, { eventTrigger, order, extraVariables = {} }) {
  try {
    const appUrl = env.APP_URL || 'https://premierperformancegk.com';
    const orderLink = order.guest_token ? `${appUrl}/shop/order/${order.guest_token}` : `${appUrl}/account/orders`;
    await sendTemplatedEmail(env, {
      eventTrigger,
      to: order.customer_email,
      userId: order.user_id ?? undefined,
      idempotencyRef: `${eventTrigger}_${order.id}`,
      variables: {
        order_number: order.order_number,
        customer_name: order.customer_name,
        total: formatMoney(env, order.total),
        items_summary: await itemsSummary(env, order.id),
        order_link: orderLink,
        fulfilment_note: collectionNote(order),
        ...extraVariables,
      },
    });
  } catch (e) {
    console.error(`Store customer email failed (non-fatal) [${eventTrigger}]:`, e.message);
  }
}

export async function sendStoreAdminEmail(env, { eventTrigger, order, extraVariables = {}, idempotencyRef }) {
  try {
    const settingsRow = await queryOne(env, "SELECT value FROM app_settings WHERE key = 'store_contact_email'");
    const to = settingsRow?.value || null;
    if (!to) return; // no admin address configured — nothing to send to
    await sendTemplatedEmail(env, {
      eventTrigger,
      to,
      idempotencyRef: idempotencyRef ?? (order ? `${eventTrigger}_${order.id}` : undefined),
      variables: order ? {
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        total: formatMoney(env, order.total),
        items_summary: await itemsSummary(env, order.id),
      } : extraVariables,
    });
  } catch (e) {
    console.error(`Store admin email failed (non-fatal) [${eventTrigger}]:`, e.message);
  }
}

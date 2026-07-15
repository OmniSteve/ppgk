/**
 * Cloudflare Worker Scheduled Handler
 *
 * Cron triggers (configured in wrangler.toml):
 *   - "0 3 * * *"  — daily at 03:00 UTC: expire credits, send reminders
 *   - "0 7 * * *"  — daily at 07:00 UTC: send session reminders
 */
import { query, queryOne, execute, audit } from './lib/db.js';
import { sendTemplatedEmail }             from './lib/email.js';
import { releaseExpiredReservations, getStoreSettings, getLowStockItems } from './lib/store.js';
import { sendStoreAdminEmail }            from './lib/storeEmail.js';

/**
 * Expire credits that have passed their expiry date.
 * Creates immutable expiry ledger entries.
 * Idempotent — checks for existing expiry entries.
 */
async function processExpiredCredits(env) {
  const now = new Date().toISOString();

  // Find package purchases that are still 'active' but past expiry
  const expired = await query(env,
    `SELECT pp.id, pp.client_id, pp.credits_granted, pp.expires_at, pp.package_definition_id,
            pd.name as package_name
     FROM package_purchases pp
     JOIN package_definitions pd ON pd.id = pp.package_definition_id
     WHERE pp.status = 'active' AND pp.expires_at < ?`,
    [now]
  );

  for (const pp of expired) {
    // Check if already expired in ledger
    const alreadyExpired = await queryOne(env,
      "SELECT id FROM credit_ledger WHERE package_purchase_id = ? AND type = 'expiry'",
      [pp.id]
    );
    if (alreadyExpired) {
      // Mark purchase as expired even if ledger entry exists
      await execute(env, "UPDATE package_purchases SET status='expired' WHERE id=?", [pp.id]);
      continue;
    }

    // Calculate remaining unused credits for this purchase.
    // Net consumption: usage (−) spends, refund (+) restores on cancellation,
    // refund_removal (−) removes credits whose money was refunded.
    const consumedRow = await queryOne(env,
      `SELECT -COALESCE(SUM(amount), 0) as consumed FROM credit_ledger
       WHERE package_purchase_id = ? AND type IN ('usage','refund','refund_removal')`,
      [pp.id]
    );
    const issued    = pp.credits_granted;
    const consumed  = Number(consumedRow?.consumed ?? 0);
    const remaining = issued - consumed;

    if (remaining > 0) {
      // Get current balance
      const balRow = await queryOne(env,
        `SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE client_id = ?`,
        [pp.client_id]
      );
      const balAfter = (balRow?.balance ?? 0) - remaining;

      await execute(env,
        `INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, package_purchase_id, description, expires_at)
         VALUES (?, ?, 'expiry', ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), pp.client_id, -remaining, balAfter, pp.id,
         `Credits expired from package: ${pp.package_name}`, pp.expires_at]
      );
    }

    await execute(env, "UPDATE package_purchases SET status='expired', updated_at=? WHERE id=?", [now, pp.id]);

    await audit(env, {
      action: 'credit', recordType: 'credit', recordId: pp.id,
      description: `Credits expired: ${remaining} from package ${pp.package_name} (client ${pp.client_id})`,
    });

    console.info(`Expired ${remaining} credits for purchase ${pp.id} (client ${pp.client_id})`);
  }

  return expired.length;
}

/**
 * Send credit expiry reminders.
 * Reads configurable reminder days from app_settings.
 */
async function sendCreditExpiryReminders(env) {
  const remSetting = await queryOne(env,
    "SELECT value FROM app_settings WHERE key='credit_expiry_reminder_days'"
  );
  const reminderDays = parseInt(remSetting?.value ?? '14');
  const cutoff = new Date(Date.now() + reminderDays * 24 * 3600 * 1000).toISOString();
  const now    = new Date().toISOString();

  const upcoming = await query(env,
    `SELECT pp.id, pp.client_id, pp.expires_at, pp.credits_granted,
            pd.name as package_name,
            u.email, u.first_name,
            (SELECT -COALESCE(SUM(amount), 0) FROM credit_ledger
             WHERE package_purchase_id = pp.id AND type IN ('usage','refund','refund_removal')) as used
     FROM package_purchases pp
     JOIN package_definitions pd ON pd.id = pp.package_definition_id
     JOIN users u ON u.id = pp.client_id
     WHERE pp.status = 'active' AND pp.expires_at > ? AND pp.expires_at <= ?`,
    [now, cutoff]
  );

  for (const pp of upcoming) {
    const remaining = pp.credits_granted - (pp.used ?? 0);
    if (remaining <= 0) continue;

    await sendTemplatedEmail(env, {
      eventTrigger:  'credit_expiry',
      to:             pp.email,
      userId:         pp.client_id,
      idempotencyRef: `credit_expiry_reminder_${pp.id}_${now.slice(0, 10)}`,
      variables: {
        first_name:   pp.first_name,
        package_name: pp.package_name,
        credits:      remaining,
        expires_at:   pp.expires_at.slice(0, 10),
      },
    });
  }

  return upcoming.length;
}

/**
 * Send session reminders to clients with confirmed bookings.
 */
async function sendSessionReminders(env) {
  const remSetting = await queryOne(env,
    "SELECT value FROM app_settings WHERE key='session_reminder_hours'"
  );
  const reminderHours = parseInt(remSetting?.value ?? '24');
  const sendSetting = await queryOne(env,
    "SELECT value FROM app_settings WHERE key='send_session_reminders'"
  );
  if (sendSetting?.value !== 'true') return 0;

  const now = new Date();
  const cutoffFrom = new Date(now.getTime() + (reminderHours - 1) * 3600 * 1000).toISOString();
  const cutoffTo   = new Date(now.getTime() + (reminderHours + 1) * 3600 * 1000).toISOString();

  // Find sessions starting within the reminder window
  const sessionDate = cutoffFrom.slice(0, 10);

  const bookings = await query(env,
    `SELECT b.id, b.client_id, b.player_id,
            s.title, s.session_date, s.start_time, s.end_time,
            l.name as location_name,
            p.first_name as player_name,
            u.email, u.first_name
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     LEFT JOIN locations l ON l.id = s.location_id
     JOIN players p ON p.id = b.player_id
     JOIN users u ON u.id = b.client_id
     WHERE b.status = 'confirmed'
       AND s.session_date = ?
       AND s.start_time BETWEEN ? AND ?`,
    [sessionDate, cutoffFrom.slice(11, 16), cutoffTo.slice(11, 16)]
  );

  for (const b of bookings) {
    await sendTemplatedEmail(env, {
      eventTrigger:  'session_reminder',
      to:             b.email,
      userId:         b.client_id,
      bookingId:      b.id,
      idempotencyRef: `session_reminder_${b.id}_${b.session_date}`,
      variables: {
        first_name:    b.first_name,
        player_name:   b.player_name,
        session_title: b.title,
        session_date:  b.session_date,
        session_time:  b.start_time,
        location:      b.location_name || 'TBC',
      },
    });
  }

  return bookings.length;
}

/**
 * Release any store inventory reservations past their 30-minute expiry
 * (abandoned checkouts) so the stock becomes available to other shoppers.
 */
async function releaseExpiredStoreReservations(env) {
  return releaseExpiredReservations(env);
}

/**
 * Email the store contact address once per day when any active product or
 * variant is at or below the configured low-stock threshold. One email per
 * run (not per item) to avoid spamming the inbox; idempotency is keyed by
 * day so re-running the cron manually the same day won't double-send.
 */
async function sendLowStockAlert(env) {
  const settings = await getStoreSettings(env);
  const items = await getLowStockItems(env, settings.store_low_stock_threshold ?? 5);
  if (items.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const summary = items.map((i) => `${i.name}${i.variant_name ? ` (${i.variant_name})` : ''}: ${i.available} left`).join('; ');
  await sendStoreAdminEmail(env, {
    eventTrigger: 'store_low_stock_admin',
    order: null,
    idempotencyRef: `store_low_stock_admin_${today}`,
    extraVariables: { product_name: items[0].name, variant_details: items[0].variant_name || '', stock_qty: items[0].available, summary, day: today },
  });
  return items.length;
}

/** Scheduled event handler — export from the worker entry point */
export async function handleScheduled(event, env, ctx) {
  const cron = event.cron;
  console.info(`Scheduled trigger: ${cron}`);

  if (cron === '0 3 * * *') {
    const expired = await processExpiredCredits(env);
    const reminded = await sendCreditExpiryReminders(env);
    console.info(`Expiry job: expired=${expired}, reminders=${reminded}`);

    const releasedReservations = await releaseExpiredStoreReservations(env);
    const lowStockCount = await sendLowStockAlert(env);
    console.info(`Store maintenance: releasedReservations=${releasedReservations}, lowStockItems=${lowStockCount}`);
  }

  if (cron === '0 7 * * *') {
    const reminded = await sendSessionReminders(env);
    console.info(`Session reminders sent: ${reminded}`);
  }
}
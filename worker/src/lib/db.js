/**
 * D1 database helpers.
 * All data access goes through env.DB (Cloudflare D1 binding).
 */

/**
 * Run a SELECT and return all rows.
 */
export async function query(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const result = await stmt.bind(...params).all();
  return result.results;
}

/**
 * Run a SELECT and return the first row (or null).
 */
export async function queryOne(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  return stmt.bind(...params).first();
}

/**
 * Run an INSERT / UPDATE / DELETE. Returns D1 meta (changes, last_row_id).
 */
export async function execute(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const result = await stmt.bind(...params).run();
  return result.meta;
}

/**
 * Run multiple statements in a single D1 batch (all-or-nothing).
 */
export async function batch(env, statements) {
  // statements: Array<{ sql: string, params?: any[] }>
  const prepared = statements.map(({ sql, params = [] }) => env.DB.prepare(sql).bind(...params));
  return env.DB.batch(prepared);
}

/**
 * Write a row to the audit_log table. Never throws — audit failures must not
 * block the main operation.
 */
export async function audit(env, { actorId, actorName, action, recordType, recordId, description, previousValue, newValue, reason, ipAddress }) {
  try {
    await execute(env,
      `INSERT INTO audit_log (actor_id, actor_name, action, record_type, record_id, description, previous_value, new_value, reason, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [actorId ?? null, actorName ?? null, action, recordType, recordId ?? null, description,
       previousValue ? JSON.stringify(previousValue) : null,
       newValue      ? JSON.stringify(newValue)      : null,
       reason ?? null, ipAddress ?? null]
    );
  } catch (err) {
    console.error('Audit write failed:', err);
  }
}
#!/bin/bash
# =============================================================================
# Premier Performance GK — Local Development Script
# Starts the Cloudflare Worker locally using wrangler dev with a local D1.
# Run: bash scripts/local-dev.sh
# =============================================================================

set -e

echo ""
echo "── Starting local development environment ───────"
echo ""
echo "  Worker URL: http://localhost:8787"
echo "  React app:  http://localhost:5173 (run: npm run dev)"
echo ""
echo "  Local D1 is used automatically — no remote DB needed."
echo "  API calls from the React app should proxy to port 8787."
echo ""

# Apply migrations to local D1 first
echo "── Applying migrations to local D1 ─────────────"
npx wrangler d1 execute ppgk --local --file=migrations/0001_initial_schema.sql 2>/dev/null || true
npx wrangler d1 execute ppgk --local --file=migrations/0002_additions.sql 2>/dev/null || true
echo "✅ Local migrations applied"
echo ""

# Optional: seed local DB
read -p "Seed local DB with sample data? (y/N): " seed
if [[ "$seed" =~ ^[Yy]$ ]]; then
  npx wrangler d1 execute ppgk --local --command="
  INSERT OR IGNORE INTO locations (id, name, city, active) VALUES
    ('loc-01', 'Ta Qali National Stadium', 'Attard', 1),
    ('loc-02', 'Centenary Stadium', 'Ta Qali', 1);
  " 2>/dev/null || true
  npx wrangler d1 execute ppgk --local --command="
  INSERT OR IGNORE INTO session_types (id, name, duration_minutes, default_capacity, credit_cost, price, active) VALUES
    ('st-01', 'Individual Training', 60, 1, 2, 40.00, 1),
    ('st-02', 'Group Training', 90, 6, 1, 20.00, 1);
  " 2>/dev/null || true
  echo "✅ Local seed applied"
  echo ""
fi

# Start worker in local mode
echo "── Starting wrangler dev ────────────────────────"
npx wrangler dev --local --port 8787
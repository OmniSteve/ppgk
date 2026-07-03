#!/bin/bash
# =============================================================================
# Premier Performance GK — D1 Development Seed Script
# Inserts sample data for local development / testing.
# Run: bash scripts/seed-d1.sh
# =============================================================================

set -e

echo ""
echo "── Seeding D1 with development data ────────────"
echo ""

# Sample locations
npx wrangler d1 execute ppgk --command="
INSERT OR IGNORE INTO locations (id, name, address_line1, city, post_code, active)
VALUES
  ('loc-01', 'Ta Qali National Stadium', 'Triq il-Pitch, Ta Qali', 'Attard', 'ATD 4000', 1),
  ('loc-02', 'Centenary Stadium', 'Triq Centinarji', 'Ta Qali', 'ATD 4001', 1),
  ('loc-03', 'Marsa Sports Complex', 'Triq il-Marsa', 'Marsa', 'MRS 1000', 1);
"
echo "✅ Locations seeded"

# Sample session types
npx wrangler d1 execute ppgk --command="
INSERT OR IGNORE INTO session_types (id, name, description, duration_minutes, default_capacity, credit_cost, price, colour, active)
VALUES
  ('st-01', 'Individual Training', '1-on-1 goalkeeper coaching session', 60, 1, 2, 40.00, '#2563EB', 1),
  ('st-02', 'Group Training', 'Small group GK training (max 6)', 90, 6, 1, 20.00, '#16A34A', 1),
  ('st-03', 'Academy Session', 'Junior goalkeeper academy for U10-U16', 75, 10, 1, 15.00, '#D97706', 1),
  ('st-04', 'Elite Camp', 'Intensive weekend training camp', 120, 8, 3, 60.00, '#7C3AED', 1);
"
echo "✅ Session types seeded"

# Sample package definitions
npx wrangler d1 execute ppgk --command="
INSERT OR IGNORE INTO package_definitions (id, name, description, credits, price, validity_months, active)
VALUES
  ('pkg-01', 'Starter Pack',    '5 session credits — perfect for trying us out',     5,  85.00, 3, 1),
  ('pkg-02', 'Standard Pack',   '10 session credits — our most popular package',     10, 160.00, 3, 1),
  ('pkg-03', 'Premium Pack',    '20 session credits — best value for regular GKs',  20, 300.00, 6, 1),
  ('pkg-04', 'Elite Annual',    '40 session credits — full year of elite training',  40, 560.00, 12, 1);
"
echo "✅ Package definitions seeded"

# Sample upcoming sessions (next 2 weeks from today)
npx wrangler d1 execute ppgk --command="
INSERT OR IGNORE INTO sessions (id, session_type_id, location_id, title, session_date, start_time, end_time, capacity, credit_cost, price, status)
VALUES
  ('ses-01', 'st-02', 'loc-01', 'Saturday Group Training',   date('now', '+3 days'),  '09:00', '10:30', 6, 1, 20.00, 'scheduled'),
  ('ses-02', 'st-03', 'loc-02', 'Academy Session U12-U14',   date('now', '+5 days'),  '10:00', '11:15', 10, 1, 15.00, 'scheduled'),
  ('ses-03', 'st-02', 'loc-01', 'Wednesday Group Training',  date('now', '+7 days'),  '18:00', '19:30', 6, 1, 20.00, 'scheduled'),
  ('ses-04', 'st-01', 'loc-03', '1-on-1 Advanced Session',   date('now', '+9 days'),  '16:00', '17:00', 1, 2, 40.00, 'scheduled'),
  ('ses-05', 'st-02', 'loc-01', 'Saturday Group Training',   date('now', '+10 days'), '09:00', '10:30', 6, 1, 20.00, 'scheduled');
"
echo "✅ Sample sessions seeded"

echo ""
echo "── Verify seed ──────────────────────────────────"
npx wrangler d1 execute ppgk --command="
SELECT 'locations' as tbl, count(*) as rows FROM locations
UNION ALL SELECT 'session_types', count(*) FROM session_types
UNION ALL SELECT 'package_definitions', count(*) FROM package_definitions
UNION ALL SELECT 'sessions', count(*) FROM sessions;
"

echo ""
echo "✅ Seed complete"
echo ""
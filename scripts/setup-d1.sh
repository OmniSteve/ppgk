#!/bin/bash
# =============================================================================
# Premier Performance GK — Cloudflare D1 Setup Script
# Run from the project root: bash scripts/setup-d1.sh
# =============================================================================

set -e

echo ""
echo "══════════════════════════════════════════════════"
echo "  Premier Performance GK — D1 Database Setup"
echo "══════════════════════════════════════════════════"
echo ""

# 1. Check wrangler is available
if ! command -v npx &> /dev/null; then
  echo "❌ npx not found. Install Node.js first: https://nodejs.org"
  exit 1
fi

echo "✅ npx found"
echo ""

# 2. Create the D1 database
echo "── Step 1: Creating D1 database 'ppgk' ──────────"
echo "   (Skip this if you already have a database_id)"
echo ""
read -p "Create a new D1 database? (y/N): " create_db

if [[ "$create_db" =~ ^[Yy]$ ]]; then
  echo ""
  DB_OUTPUT=$(npx wrangler d1 create ppgk 2>&1)
  echo "$DB_OUTPUT"
  echo ""

  # Extract database_id from wrangler output
  DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)"/\1/' | tr -d '"')

  if [ -n "$DB_ID" ]; then
    echo "✅ Database created. ID: $DB_ID"
    echo ""
    echo "── Patching wrangler.toml ──────────────────────"
    # Replace the placeholder in wrangler.toml
    sed -i.bak "s/REPLACE_WITH_YOUR_D1_DATABASE_ID/$DB_ID/" wrangler.toml
    echo "✅ wrangler.toml updated with database_id = \"$DB_ID\""
    rm -f wrangler.toml.bak
  else
    echo "⚠️  Could not auto-detect database_id."
    echo "   Copy the database_id from the output above and paste it into wrangler.toml:"
    echo "   database_id = \"<your-id-here>\""
  fi
else
  echo ""
  read -p "Enter your existing D1 database_id: " EXISTING_ID
  if [ -n "$EXISTING_ID" ]; then
    sed -i.bak "s/REPLACE_WITH_YOUR_D1_DATABASE_ID/$EXISTING_ID/" wrangler.toml
    echo "✅ wrangler.toml updated with database_id = \"$EXISTING_ID\""
    rm -f wrangler.toml.bak
  fi
fi

echo ""
echo "── Step 2: Running migrations ───────────────────"
echo ""

# Run migration 0001
echo "▶  Running 0001_initial_schema.sql ..."
npx wrangler d1 execute ppgk --file=migrations/0001_initial_schema.sql
echo "✅ 0001_initial_schema.sql applied"
echo ""

# Run migration 0002
echo "▶  Running 0002_additions.sql ..."
npx wrangler d1 execute ppgk --file=migrations/0002_additions.sql
echo "✅ 0002_additions.sql applied"
echo ""

echo "── Step 3: Verify tables ─────────────────────────"
echo ""
npx wrangler d1 execute ppgk --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
echo ""

echo "── Step 4: Set required secrets ─────────────────"
echo "   Run each of the following (you'll be prompted for the value):"
echo ""
echo "   npx wrangler secret put JWT_SECRET"
echo "   npx wrangler secret put STRIPE_SECRET"
echo "   npx wrangler secret put STRIPE_WEBHOOK_SECRET"
echo "   npx wrangler secret put RESEND_API_KEY"
echo "   npx wrangler secret put APP_URL"
echo ""

read -p "Set secrets now interactively? (y/N): " set_secrets

if [[ "$set_secrets" =~ ^[Yy]$ ]]; then
  echo ""
  echo "Setting JWT_SECRET ..."
  npx wrangler secret put JWT_SECRET

  echo "Setting STRIPE_SECRET ..."
  npx wrangler secret put STRIPE_SECRET

  echo "Setting STRIPE_WEBHOOK_SECRET ..."
  npx wrangler secret put STRIPE_WEBHOOK_SECRET

  echo "Setting RESEND_API_KEY ..."
  npx wrangler secret put RESEND_API_KEY

  echo "Setting APP_URL ..."
  npx wrangler secret put APP_URL

  echo ""
  echo "✅ All secrets set"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  ✅ D1 setup complete!"
echo ""
echo "  Next steps:"
echo "  1. npx wrangler deploy         — deploy the Worker"
echo "  2. npm run build               — build the React app"
echo "  3. npx wrangler pages deploy dist --project-name=ppgk"
echo "══════════════════════════════════════════════════"
echo ""
#!/bin/sh
cd apps/api

# 1. Attempt migration
npx prisma migrate deploy 2>&1
MIGRATE_EXIT=$?

# 2. If P3009/P3018 (stuck/failed migration), try auto-resolve
if [ $MIGRATE_EXIT -ne 0 ]; then
  echo ""
  echo "🔄 Migration failed — attempting auto-resolve"

  # Check if support_diagnostic_cases table already has data
  HAS_DATA=$(echo "SELECT COUNT(*) AS cnt FROM support_diagnostic_cases" | npx prisma db execute --stdin 2>/dev/null || echo "")
  HAS_TABLE=$(echo "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'support_diagnostic_cases'" | npx prisma db execute --stdin 2>/dev/null || echo "")

  if echo "$HAS_DATA" | grep -q "[1-9]"; then
    echo "✅ Table has data — marking migration as already applied"
    npx prisma migrate resolve --applied "20260501154100_add_support_tables" 2>&1 || true
  elif echo "$HAS_TABLE" | grep -q "1"; then
    echo "✅ Table exists (empty) — marking migration as applied"
    npx prisma migrate resolve --applied "20260501154100_add_support_tables" 2>&1 || true
  else
    echo "🔄 No existing data — rolling back and retrying"
    npx prisma migrate resolve --rolled-back "20260501154100_add_support_tables" 2>&1 || true
  fi

  echo ""
  echo "🔄 Retrying deployment..."
  npx prisma migrate deploy 2>&1 || echo "⚠️ Migration retry failed — continuing to start app"
fi

node dist/src/main

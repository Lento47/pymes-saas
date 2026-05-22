#!/bin/sh
set -u

cd apps/api

run_migrate_deploy() {
  npx prisma migrate deploy 2>&1
}

# 1. Attempt migration
MIGRATE_OUTPUT=$(run_migrate_deploy)
MIGRATE_EXIT=$?
printf '%s\n' "$MIGRATE_OUTPUT"

# 2. If P3009/P3018 (stuck/failed migration), try auto-resolve
if [ $MIGRATE_EXIT -ne 0 ]; then
  echo ""
  echo "🔄 Migration failed — attempting auto-resolve"

  FAILED_MIGRATION=$(printf '%s\n' "$MIGRATE_OUTPUT" | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p' | tail -n 1)

  if [ -z "$FAILED_MIGRATION" ]; then
    echo "❌ Could not identify failed Prisma migration; refusing to guess"
    exit $MIGRATE_EXIT
  fi

  echo "🔎 Failed migration detected: $FAILED_MIGRATION"

  if [ "$FAILED_MIGRATION" = "20260501154100_add_support_tables" ]; then
    # Legacy recovery for the support table migration that could fail after the
    # tables were already created. Only mark applied when the table exists.
    HAS_DATA=$(echo "SELECT COUNT(*) AS cnt FROM support_diagnostic_cases" | npx prisma db execute --stdin 2>/dev/null || echo "")
    HAS_TABLE=$(echo "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_diagnostic_cases'" | npx prisma db execute --stdin 2>/dev/null || echo "")

    if echo "$HAS_DATA" | grep -q "[1-9]"; then
      echo "✅ support_diagnostic_cases has data — marking migration as already applied"
      npx prisma migrate resolve --applied "$FAILED_MIGRATION" 2>&1 || true
    elif echo "$HAS_TABLE" | grep -q "1"; then
      echo "✅ support_diagnostic_cases exists — marking migration as applied"
      npx prisma migrate resolve --applied "$FAILED_MIGRATION" 2>&1 || true
    else
      echo "🔄 support_diagnostic_cases does not exist — marking migration rolled back"
      npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" 2>&1 || true
    fi
  else
    echo "🔄 Marking failed migration as rolled back before retry"
    npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" 2>&1 || true
  fi

  echo ""
  echo "🔄 Retrying deployment..."
  RETRY_OUTPUT=$(run_migrate_deploy)
  RETRY_EXIT=$?
  printf '%s\n' "$RETRY_OUTPUT"

  if [ $RETRY_EXIT -ne 0 ]; then
    echo "❌ Migration retry failed — refusing to start app with an unverified schema"
    exit $RETRY_EXIT
  fi
fi

node dist/src/main

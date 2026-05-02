#!/bin/sh
cd apps/api

# 1. Attempt migration
npx prisma migrate deploy 2>&1
MIGRATE_EXIT=$?

# 2. If P3009 (stuck migration), try auto-resolve
if [ $MIGRATE_EXIT -ne 0 ]; then
  echo ""
  echo "🔄 Migration failed — attempting auto-resolve of stuck migration"

  # Check if tables already exist
  TABLE_EXISTS=$(echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'support_diagnostic_cases'" | npx prisma db execute --stdin 2>&1)

  if echo "$TABLE_EXISTS" | grep -q "count.*1"; then
    echo "✅ Tables already exist — marking migration as applied"
    npx prisma migrate resolve --applied "20260501154100_add_support_tables" 2>&1 || true
  else
    echo "🔄 Tables missing — rolling back failed migration"
    npx prisma migrate resolve --rolled-back "20260501154100_add_support_tables" 2>&1 || true
  fi

  echo ""
  echo "🔄 Retrying deployment..."
  npx prisma migrate deploy 2>&1 || echo "⚠️ Migration retry failed — continuing to start app"
fi

node dist/src/main

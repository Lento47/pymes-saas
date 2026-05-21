#!/bin/bash
# pre-push check — verifica lo que el CI de Railway no perdonaría
# Corre desde la raíz del monorepo

set -e

echo "🔍 pre-push check..."

# 1. Conflict markers
CONFLICTS=$(grep -rn "^<<<<<<< \|^=======$\|^>>>>>>> " apps/api/src/ apps/api/prisma/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v "// ===" | wc -l)
if [ "$CONFLICTS" -gt 0 ]; then
  echo "❌ $CONFLICTS conflict markers found"
  grep -rn "^<<<<<<< \|^>>>>>>> " apps/api/src/ apps/api/prisma/ --include="*.ts" --include="*.prisma" | grep -v "// ==="
  exit 1
fi

# 2. Duplicate function/class names in changed TS files
for f in $(git diff --cached --name-only -- '*.ts'); do
  DUPES=$(grep -oP '(async |private |public )?\w+\(' "$f" | sort | uniq -d)
  if [ -n "$DUPES" ]; then
    echo "❌ Duplicate methods in $f:"
    echo "$DUPES"
    exit 1
  fi
done

# 3. Prisma schema valid?
if git diff --cached --name-only | grep -q "schema.prisma"; then
  echo "🔍 Checking Prisma schema..."
  cd apps/api && npx prisma validate --schema ./prisma/schema.prisma || exit 1
  cd ../..
fi

# 4. Prisma generate succeeds?
if git diff --cached --name-only | grep -qE "(schema.prisma|migrations/)"; then
  echo "🔍 Running prisma generate..."
  cd apps/api && npx prisma generate --schema ./prisma/schema.prisma || exit 1
  cd ../..
fi

# 5. Critical modules still registered in app.module.ts?
if git diff --cached --name-only | grep -q "app.module.ts"; then
  echo "🔍 Checking critical modules in app.module.ts..."
  REQUIRED_MODULES=("HealthModule" "WhatsAppModule" "ConversationsModule" "AuthModule" "PrismaModule")
  MISSING=""
  for mod in "${REQUIRED_MODULES[@]}"; do
    if ! grep -q "$mod" apps/api/src/app.module.ts; then
      MISSING="$MISSING $mod"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "❌ CRITICAL modules missing from app.module.ts:$MISSING"
    echo "   Estas borrando módulos de producción. Si es intencional, edita este script."
    exit 1
  fi
fi

# 6. WhatsAppService has critical methods?
if git diff --cached --name-only | grep -q "whatsapp.service.ts"; then
  echo "🔍 Checking WhatsAppService critical methods..."
  REQUIRED_METHODS=("sendMessage" "processInbound" "sendMedia" "sendTemplateMessage" "ingestWebhook")
  MISSING=""
  for method in "${REQUIRED_METHODS[@]}"; do
    if ! grep -q "async $method" apps/api/src/whatsapp/whatsapp.service.ts; then
      MISSING="$MISSING $method"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "❌ CRITICAL methods missing from WhatsAppService:$MISSING"
    echo "   Estas borrando métodos que el controller necesita. Si es intencional, edita este script."
    exit 1
  fi
fi

# 7. WhatsAppModule exports required providers?
if git diff --cached --name-only | grep -q "whatsapp.module.ts"; then
  echo "🔍 Checking WhatsAppModule exports..."
  if ! grep -q "exports:.*WhatsAppService" apps/api/src/whatsapp/whatsapp.module.ts; then
    echo "❌ WhatsAppModule must export WhatsAppService"
    exit 1
  fi
fi

echo "✅ All pre-push checks passed"

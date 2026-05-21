#!/bin/bash
# pre-push check — verifica lo que el CI de Railway no perdonaría
# Corre desde la raíz del monorepo
#
# Usar:  bash scripts/pre-push-check.sh
# O como git hook:  ln -s ../../scripts/pre-push-check.sh .git/hooks/pre-push

set -e

echo "🔍 pre-push check..."

# ── 1. TypeScript compila sin errores ──────────────────────────────────
# Este es el check MÁS importante. Si no compila, Railway explota.
echo "🔍 TypeScript check (tsc --noEmit)..."
cd apps/api && npx tsc --noEmit || { echo "❌ TypeScript errors found. Corrige antes de pushear."; exit 1; }
cd ../..

# ── 2. Conflict markers ────────────────────────────────────────────────
CONFLICTS=$(grep -rn "^<<<<<<< \|^=======$\|^>>>>>>> " apps/api/src/ apps/api/prisma/ --include="*.ts" --include="*.prisma" 2>/dev/null | grep -v "// ===" | wc -l)
if [ "$CONFLICTS" -gt 0 ]; then
  echo "❌ $CONFLICTS conflict markers found"
  grep -rn "^<<<<<<< \|^>>>>>>> " apps/api/src/ apps/api/prisma/ --include="*.ts" --include="*.prisma" | grep -v "// ==="
  exit 1
fi

# ── 3. Duplicate function/class names in changed TS files ──────────────
for f in $(git diff --cached --name-only -- '*.ts' 2>/dev/null); do
  DUPES=$(grep -oP '(async |private |public )?\w+\(' "$f" | sort | uniq -d)
  if [ -n "$DUPES" ]; then
    echo "❌ Duplicate methods in $f:"
    echo "$DUPES"
    exit 1
  fi
done

# ── 4. Prisma schema valid? ────────────────────────────────────────────
if git diff --cached --name-only 2>/dev/null | grep -q "schema.prisma"; then
  echo "🔍 Checking Prisma schema..."
  cd apps/api && npx prisma validate --schema ./prisma/schema.prisma || exit 1
  cd ../..
fi

# ── 5. Prisma generate succeeds? ───────────────────────────────────────
if git diff --cached --name-only 2>/dev/null | grep -qE "(schema.prisma|migrations/)"; then
  echo "🔍 Running prisma generate..."
  cd apps/api && npx prisma generate --schema ./prisma/schema.prisma || exit 1
  cd ../..
fi

# ── 6. Critical modules still registered in app.module.ts? ─────────────
if git diff --cached --name-only 2>/dev/null | grep -q "app.module.ts"; then
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
    echo "   Estás borrando módulos de producción. Si es intencional, edita este script."
    exit 1
  fi
fi

# ── 7. WhatsAppService has critical methods? ───────────────────────────
if git diff --cached --name-only 2>/dev/null | grep -q "whatsapp.service.ts"; then
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
    echo "   Estás borrando métodos que el controller necesita. Si es intencional, edita este script."
    exit 1
  fi
fi

# ── 8. WhatsAppModule exports required providers? ──────────────────────
if git diff --cached --name-only 2>/dev/null | grep -q "whatsapp.module.ts"; then
  echo "🔍 Checking WhatsAppModule exports..."
  if ! grep -q "exports:.*WhatsAppService" apps/api/src/whatsapp/whatsapp.module.ts; then
    echo "❌ WhatsAppModule must export WhatsAppService"
    exit 1
  fi
fi

echo "✅ All pre-push checks passed"

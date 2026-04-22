#!/bin/bash
set -e

# Build Enterprise Bundle - empaqueta API, Web y Node.js para el Tauri app

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/.enterprise-runtime-bundle"
API_SRC="$ROOT_DIR/apps/api"
WEB_SRC="$ROOT_DIR/apps/web"

echo "🔨 Building Enterprise Runtime Bundle..."

# Clean previous bundle
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"

# Build API
echo "📦 Building API..."
cd "$API_SRC"
pnpm install --frozen-lockfile
pnpm run build
pnpm prune --prod

# Copy API to bundle
echo "📋 Packaging API..."
mkdir -p "$BUNDLE_DIR/a"
cp -r "$API_SRC/dist" "$BUNDLE_DIR/a/"
cp -r "$API_SRC/node_modules" "$BUNDLE_DIR/a/"
cp -r "$API_SRC/prisma" "$BUNDLE_DIR/a/"
cp "$API_SRC/.env.enterprise.example" "$BUNDLE_DIR/a/" 2>/dev/null || true

# Copy schema.sql to API bundle
echo "📄 Adding database schema..."
if [ -f "$API_SRC/prisma/schema.enterprise.sqlite.sql" ]; then
  cp "$API_SRC/prisma/schema.enterprise.sqlite.sql" "$BUNDLE_DIR/a/schema.sql"
else
  echo "⚠️  Warning: schema.enterprise.sqlite.sql not found, generating..."
  cd "$API_SRC"
  pnpm run db:generate:enterprise
  cp "$API_SRC/prisma/schema.enterprise.sqlite.sql" "$BUNDLE_DIR/a/schema.sql"
fi

# Build Web
echo "🌐 Building Web..."
cd "$WEB_SRC"
pnpm install --frozen-lockfile
pnpm run build

# Copy Web to bundle
echo "📋 Packaging Web..."
mkdir -p "$BUNDLE_DIR/w"
cp -r "$WEB_SRC/dist" "$BUNDLE_DIR/w/"
cp "$WEB_SRC/package.json" "$BUNDLE_DIR/w/"
cp -r "$WEB_SRC/node_modules" "$BUNDLE_DIR/w/"

echo "✅ Enterprise Runtime Bundle ready at $BUNDLE_DIR"
echo ""
echo "Next steps:"
echo "1. Copy .enterprise-runtime-bundle to apps/desktop/src-tauri/resources/"
echo "2. Run: pnpm --filter @pymeshub/desktop tauri:build:enterprise"

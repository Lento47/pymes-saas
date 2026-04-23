#!/bin/bash
# Fast enterprise build script - parallelizes installations and builds

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting optimized enterprise build..."
echo ""

# 1. Install root dependencies (once)
echo "📦 Installing root dependencies..."
cd "$ROOT_DIR"
pnpm install --frozen-lockfile

# 2. Install API and Web in PARALLEL
echo ""
echo "⚡ Installing API and Web dependencies (parallel)..."
(cd "$ROOT_DIR/apps/api" && pnpm install --frozen-lockfile) &
API_PID=$!

(cd "$ROOT_DIR/apps/web" && pnpm install --frozen-lockfile) &
WEB_PID=$!

wait $API_PID $WEB_PID

# 3. Build API and Web in PARALLEL
echo ""
echo "🔨 Building API and Web (parallel)..."
(cd "$ROOT_DIR/apps/api" && pnpm run build) &
API_BUILD_PID=$!

(cd "$ROOT_DIR/apps/web" && pnpm run build) &
WEB_BUILD_PID=$!

wait $API_BUILD_PID $WEB_BUILD_PID

# 4. Prepare enterprise runtime
echo ""
echo "📋 Preparing enterprise runtime..."
cd "$ROOT_DIR/apps/desktop"
pnpm run prepare:enterprise-runtime

# 5. Build enterprise MSI
echo ""
echo "📦 Building MSI installer..."
pnpm run tauri:build:enterprise

echo ""
echo "✅ Build complete!"
echo ""
echo "Output:"
ls -lh "$ROOT_DIR/apps/desktop/src-tauri/target/release/bundle/msi/"

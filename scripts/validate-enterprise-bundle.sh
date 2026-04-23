#!/bin/bash
# Validate that enterprise runtime bundle is complete before building MSI

set -e

echo "Validating enterprise runtime bundle..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/.enterprise-runtime-bundle"
TAURI_RESOURCES="$ROOT_DIR/apps/desktop/src-tauri/resources/enterprise-runtime"

# Check if bundle exists
if [ ! -d "$BUNDLE_DIR" ]; then
  echo "❌ ERROR: .enterprise-runtime-bundle not found"
  echo "   Run: ./scripts/build-enterprise-bundle.sh"
  exit 1
fi

# Required files in bundle
REQUIRED_FILES=(
  "$BUNDLE_DIR/a/dist/src/main.js"
  "$BUNDLE_DIR/a/schema.sql"
  "$BUNDLE_DIR/a/prisma/schema.prisma"
  "$BUNDLE_DIR/a/node_modules/.prisma/client/index.js"
  "$BUNDLE_DIR/w/dist/index.cjs"
  "$BUNDLE_DIR/w/node_modules"
)

MISSING=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -e "$file" ]; then
    echo "❌ Missing: $file"
    MISSING=$((MISSING + 1))
  else
    echo "✓ Found: $(basename $file)"
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "❌ Bundle validation failed ($MISSING files missing)"
  echo "   Run: ./scripts/build-enterprise-bundle.sh"
  exit 1
fi

# Check if Tauri resources exist and are up-to-date
if [ -d "$TAURI_RESOURCES" ]; then
  # Compare modification times
  BUNDLE_MTIME=$(stat -f%m "$BUNDLE_DIR/a/dist/src/main.js" 2>/dev/null || stat -c%Y "$BUNDLE_DIR/a/dist/src/main.js")
  TAURI_MTIME=$(stat -f%m "$TAURI_RESOURCES/a/dist/src/main.js" 2>/dev/null || stat -c%Y "$TAURI_RESOURCES/a/dist/src/main.js" 2>/dev/null || echo "0")

  if [ "$TAURI_MTIME" -lt "$BUNDLE_MTIME" ]; then
    echo "⚠️  WARNING: Tauri resources are outdated"
    echo "   Run: cp -r .enterprise-runtime-bundle/* apps/desktop/src-tauri/resources/enterprise-runtime/"
  fi
fi

echo ""
echo "✅ Enterprise runtime bundle is valid"
echo ""

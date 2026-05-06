#!/usr/bin/env bash
# =============================================================================
# check-deploy-branch.sh — Pre-push checklist for deploy branches
# =============================================================================
# Usage: bash scripts/check-deploy-branch.sh
#
# Steps:
#   1. Detect current branch → main-web or main-api (exit silently if neither)
#   2. Branch-scope check
#   3. If main-api: prisma generate
#   4. Target-specific smoke build
# =============================================================================
set -euo pipefail

BRANCH=$(git branch --show-current)
TARGET=""

case "$BRANCH" in
  main-web) TARGET="web" ;;
  main-api) TARGET="api" ;;
  *)
    echo "==> Not on a deploy branch (main-web / main-api). Skipping."
    exit 0
    ;;
esac

echo ""
echo "=============================================="
echo " Pre-push checklist — $BRANCH"
echo "=============================================="
echo ""

# ── Step 1: Branch-scope check ──────────────────────────────────────────────

echo "[1/3] Branch-scope check..."

REMOTE=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  echo "  No upstream set. Checking against last commit."
  RANGE="HEAD^..HEAD"
else
  RANGE="$REMOTE..HEAD"
fi

if [ "$TARGET" = "web" ]; then
  FORBIDDEN=$(git diff --name-only $RANGE | grep -E '^apps/api/|^pnpm-lock\.yaml$' || true)
  if [ -n "$FORBIDDEN" ]; then
    echo "  FAIL: main-web MUST NOT contain apps/api/** or pnpm-lock.yaml"
    echo "  Forbidden files:"
    echo "$FORBIDDEN" | sed 's/^/    - /'
    exit 1
  fi
  SHARED=$(git diff --name-only $RANGE | grep -E '^packages/shared-types/' || true)
  if [ -n "$SHARED" ]; then
    echo "  WARNING: shared-types change detected. Ensure this is also pushed to main-api."
    echo "$SHARED" | sed 's/^/    - /'
  fi
elif [ "$TARGET" = "api" ]; then
  FORBIDDEN=$(git diff --name-only $RANGE | grep -E '^apps/web/' || true)
  if [ -n "$FORBIDDEN" ]; then
    echo "  FAIL: main-api MUST NOT contain apps/web/**"
    echo "  Forbidden files:"
    echo "$FORBIDDEN" | sed 's/^/    - /'
    exit 1
  fi
  SHARED=$(git diff --name-only $RANGE | grep -E '^packages/shared-types/' || true)
  if [ -n "$SHARED" ]; then
    echo "  WARNING: shared-types change detected. Ensure this is also pushed to main-web."
    echo "$SHARED" | sed 's/^/    - /'
  fi
fi

echo "  PASS"

# ── Step 2: Prisma generate (API only) ─────────────────────────────────────

if [ "$TARGET" = "api" ]; then
  echo ""
  echo "[2/3] Prisma generate..."
  (cd apps/api && pnpm exec prisma generate)
  echo "  PASS"
else
  echo ""
  echo "[2/3] Prisma generate... (skipped for web)"
fi

# ── Step 3: Smoke build ─────────────────────────────────────────────────────

echo ""
echo "[3/3] Smoke build..."

if [ "$TARGET" = "web" ]; then
  (cd apps/web && pnpm run build)
elif [ "$TARGET" = "api" ]; then
  (cd apps/api && pnpm run build)
fi

echo "  PASS"

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "=============================================="
echo " Pre-push checklist PASSED — $BRANCH"
echo "=============================================="
echo ""
echo "  You may now push: git push"
echo ""

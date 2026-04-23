#!/bin/bash
# Aggressive optimization for enterprise MSI build

echo "🔥 Optimizing PyMeshHub Enterprise Build..."

# 1. Remove development dependencies from API
echo "Cleaning API dist..."
find /home/user/pymes-saas/apps/api/dist -name "*.map" -delete  # Remove source maps
find /home/user/pymes-saas/apps/api/dist -name "*.d.ts" -delete # Remove TypeScript defs
du -sh /home/user/pymes-saas/apps/api/dist

# 2. Remove development dependencies from Web
echo "Cleaning Web dist..."
find /home/user/pymes-saas/apps/web/dist -name "*.map" -delete
du -sh /home/user/pymes-saas/apps/web/dist

# 3. Clean node_modules of development-only packages
echo "Purging unnecessary node_modules..."
rm -rf /home/user/pymes-saas/node_modules/.pnpm/*/@types/*  # Remove all @types (dev only)
rm -rf /home/user/pymes-saas/node_modules/.pnpm/*/typescript*
rm -rf /home/user/pymes-saas/node_modules/.pnpm/*/jest*
rm -rf /home/user/pymes-saas/node_modules/.pnpm/*/eslint*
rm -rf /home/user/pymes-saas/node_modules/.pnpm/*/@testing-library*

# 4. Clean node_modules duplicates
echo "Deduplicating node_modules..."
pnpm dedupe

# 5. Remove cache and temporary files
echo "Cleaning caches..."
rm -rf /home/user/pymes-saas/.pnpm-store
rm -rf /home/user/pymes-saas/.next
rm -rf /home/user/pymes-saas/dist

# 6. Final sizes
echo ""
echo "=== Final Size Report ==="
du -sh /home/user/pymes-saas/node_modules
du -sh /home/user/pymes-saas/apps/api/dist
du -sh /home/user/pymes-saas/apps/web/dist
du -sh /home/user/pymes-saas/.enterprise-runtime-release

echo ""
echo "✅ Optimization complete!"

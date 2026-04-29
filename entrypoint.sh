#!/bin/sh
cd apps/api
npx prisma migrate deploy || echo "[WARN] Migration skipped — starting without it"
node dist/src/main

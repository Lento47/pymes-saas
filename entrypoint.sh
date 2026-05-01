#!/bin/sh
cd apps/api

# Prisma 7 writes config-loading to stderr. Merge into stdout to avoid Railway's red coloring.
# A failed migration must not prevent the app from starting.
npx prisma migrate deploy 2>&1 || echo "⚠️ Migration step failed — continuing to start app"

node dist/src/main

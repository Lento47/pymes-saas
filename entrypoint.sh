#!/bin/sh
set -e
cd apps/api
npx prisma migrate deploy
node dist/src/main

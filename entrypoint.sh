#!/bin/sh
cd apps/api
npx prisma migrate deploy
node dist/src/main

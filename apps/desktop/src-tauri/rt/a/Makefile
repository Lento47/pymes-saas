# ─────────────────────────────────────────────────────────────────────────────
# Makefile — pymes SaaS local dev helpers
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: dev dev-down logs db-migrate db-seed db-studio build prod-up help

# ── Development ──────────────────────────────────────────────────────────────

## Start backing services (postgres, redis, minio) in the background
dev:
	docker compose up -d postgres redis minio

## Stop all containers and remove orphans
dev-down:
	docker compose down --remove-orphans

## Stream API logs (Ctrl-C to stop)
logs:
	docker compose logs -f api

# ── Database ─────────────────────────────────────────────────────────────────

## Apply pending Prisma migrations (safe for CI/CD pipelines)
db-migrate:
	pnpm exec prisma migrate deploy

## Run the database seed script
db-seed:
	pnpm exec ts-node --project tsconfig.json prisma/seed.ts

## Open Prisma Studio (browser-based DB explorer)
db-studio:
	pnpm exec prisma studio

# ── Docker build ──────────────────────────────────────────────────────────────

## Build the API Docker image
build:
	docker compose build api

# ── Production ────────────────────────────────────────────────────────────────

## Start all services with the production override (requires external volumes & secrets)
prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# ── Help ──────────────────────────────────────────────────────────────────────

## Print available targets
help:
	@echo ""
	@echo "Available make targets:"
	@echo ""
	@grep -E '^##' Makefile | sed 's/^## /  /'
	@echo ""

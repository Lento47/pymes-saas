#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config_path="$repository_root/packages/trpc-api/wrangler.toml"
scratch_root="$(mktemp -d)"

cleanup() {
	rm -rf -- "$scratch_root"
}
trap cleanup EXIT

apply_migrations() {
	local persistence_path="$1"
	pnpm --dir "$repository_root/packages/db" exec wrangler d1 migrations apply pymhubdb \
		--local \
		--persist-to "$persistence_path" \
		--config "$config_path"
}

echo "Rehearsing all migrations against a fresh local D1 database..."
apply_migrations "$scratch_root/fresh"

echo "Reapplying against a database with every migration already recorded..."
apply_migrations "$scratch_root/fresh"

if [[ $# -gt 0 ]]; then
	schema_copy="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
	if [[ ! -f "$schema_copy" ]]; then
		echo "Schema copy not found: $schema_copy" >&2
		exit 1
	fi

	echo "Rehearsing against the supplied production schema copy..."
	pnpm --dir "$repository_root/packages/db" exec wrangler d1 execute pymhubdb \
		--local \
		--persist-to "$scratch_root/production-schema" \
		--config "$config_path" \
		--file "$schema_copy"

	# A schema-only D1 export intentionally omits the platform's migration-history
	# metadata. Asking `migrations apply` to consume that copy would therefore replay
	# migration 0000 over tables that already exist. Apply the candidate (latest)
	# migration directly: this is the compatibility question a production-schema
	# rehearsal needs to answer, while the fresh and recorded-history paths above verify
	# the complete chain and Wrangler's idempotence separately.
	candidate_migration="$(find "$repository_root/packages/db/migrations" -maxdepth 1 -type f -name '*.sql' | sort | tail -n 1)"
	if [[ -z "$candidate_migration" ]]; then
		echo "No candidate migration was found." >&2
		exit 1
	fi
	pnpm --dir "$repository_root/packages/db" exec wrangler d1 execute pymhubdb \
		--local \
		--persist-to "$scratch_root/production-schema" \
		--config "$config_path" \
		--file "$candidate_migration"
fi

echo "D1 migration rehearsal passed."

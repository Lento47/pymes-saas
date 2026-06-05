#!/usr/bin/env bash
# restore-backup.sh — PymesHub PostgreSQL restore from local or S3 backup
#
# Usage:
#   ./scripts/restore-backup.sh <backup-file.sql.gz>          # local file
#   ./scripts/restore-backup.sh s3://<bucket>/<key>.sql.gz    # from S3
#
# Requirements: pg_restore / psql, aws CLI (for S3 source), gzip
#
# Env vars required:
#   DATABASE_URL              — postgres://user:pass@host:port/dbname
#   AWS_ACCESS_KEY_ID         — S3 credentials (only for S3 source)
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION        — default: us-east-1
#   STORAGE_ENDPOINT          — optional, for MinIO/S3-compatible
#   STORAGE_BUCKET            — optional, used in listing available backups

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[restore]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}   $*"; }
die()  { echo -e "${RED}[error]${NC}  $*" >&2; exit 1; }

# ── Validate args ──────────────────────────────────────────────────────────────
[[ "${1:-}" == "" ]] && die "Usage: $0 <backup-file.sql.gz | s3://bucket/key.sql.gz>"
SOURCE="$1"

# ── Parse DATABASE_URL ─────────────────────────────────────────────────────────
: "${DATABASE_URL:?DATABASE_URL env var is required}"
DB_URL="$DATABASE_URL"

# Extract components via sed (avoids requiring python/perl)
DB_HOST=$(echo "$DB_URL" | sed -E 's|postgres(ql)?://[^@]+@([^:/]+).*|\2|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DB_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_USER=$(echo "$DB_URL" | sed -E 's|postgres(ql)?://([^:@]+).*|\2|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|postgres(ql)?://[^:]+:([^@]+)@.*|\2|')

[[ -z "$DB_HOST" || -z "$DB_NAME" || -z "$DB_USER" ]] && die "Could not parse DATABASE_URL"

export PGPASSWORD="$DB_PASS"
export PGHOST="$DB_HOST"
export PGPORT="${DB_PORT:-5432}"
export PGUSER="$DB_USER"

# ── Safety confirmation ────────────────────────────────────────────────────────
echo ""
echo -e "${RED}⚠️  WARNING — DESTRUCTIVE OPERATION${NC}"
echo "This will DROP and recreate the database: $DB_NAME on $DB_HOST:${DB_PORT:-5432}"
echo "All current data will be LOST. This cannot be undone."
echo ""
read -r -p "Type 'yes I understand' to continue: " CONFIRM
[[ "$CONFIRM" != "yes I understand" ]] && die "Aborted."
echo ""

# ── Fetch backup from S3 if needed ────────────────────────────────────────────
LOCAL_FILE=""
CLEANUP_LOCAL=false

if [[ "$SOURCE" == s3://* ]]; then
  log "Downloading backup from S3: $SOURCE"
  LOCAL_FILE=$(mktemp /tmp/pymeshub-restore-XXXXXX.sql.gz)
  CLEANUP_LOCAL=true

  ENDPOINT_OPTS=""
  if [[ -n "${STORAGE_ENDPOINT:-}" ]]; then
    ENDPOINT_OPTS="--endpoint-url $STORAGE_ENDPOINT"
  fi

  aws s3 cp $ENDPOINT_OPTS "$SOURCE" "$LOCAL_FILE" || die "Failed to download from S3"
  log "Downloaded to: $LOCAL_FILE"
else
  LOCAL_FILE="$SOURCE"
  [[ -f "$LOCAL_FILE" ]] || die "File not found: $LOCAL_FILE"
fi

# ── Verify file is valid gzip ──────────────────────────────────────────────────
gzip -t "$LOCAL_FILE" 2>/dev/null || die "File is not valid gzip: $LOCAL_FILE"
SIZE_MB=$(du -m "$LOCAL_FILE" | cut -f1)
log "Backup file: $LOCAL_FILE (${SIZE_MB} MB compressed)"

# ── Terminate existing connections ─────────────────────────────────────────────
log "Terminating active connections to $DB_NAME..."
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || warn "Could not terminate connections (proceeding anyway)"

# ── Drop and recreate database ─────────────────────────────────────────────────
log "Dropping database: $DB_NAME"
psql -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" || die "Failed to drop database"

log "Creating database: $DB_NAME"
psql -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" || die "Failed to create database"

# ── Restore ────────────────────────────────────────────────────────────────────
log "Restoring from backup..."
START_TS=$(date +%s)
gunzip -c "$LOCAL_FILE" | psql -d "$DB_NAME" -v ON_ERROR_STOP=0 2>&1 | grep -E "^(ERROR|FATAL)" | head -20 || true

# Check restore worked by counting tables
TABLE_COUNT=$(psql -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

if [[ "${TABLE_COUNT:-0}" -lt 10 ]]; then
  die "Restore appears incomplete — only $TABLE_COUNT tables found. Check output above."
fi

log "Restore complete in ${ELAPSED}s — ${TABLE_COUNT} tables restored to $DB_NAME"

# ── Cleanup temp file ──────────────────────────────────────────────────────────
if [[ "$CLEANUP_LOCAL" == "true" ]]; then
  rm -f "$LOCAL_FILE"
  log "Temp file removed"
fi

echo ""
echo -e "${GREEN}✅ Restore successful${NC}"
echo "  Database : $DB_NAME"
echo "  Host     : $DB_HOST:${DB_PORT:-5432}"
echo "  Tables   : $TABLE_COUNT"
echo "  Duration : ${ELAPSED}s"
echo ""
warn "Next step: restart the API server to clear connection pools."

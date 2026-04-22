#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy manual en servidor Linux
# NestJS SaaS con Docker + docker compose + Prisma
# =============================================================================
#
# USO:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh [IMAGE_TAG]
#
# VARIABLES DE ENTORNO (pueden pasarse como argumentos o estar en el entorno):
#   IMAGE_TAG        — Tag de la imagen a desplegar (default: latest)
#   REGISTRY         — Registry Docker (default: ghcr.io)
#   REPO             — Nombre del repositorio (ej: myorg/myapp)
#   APP_DIR          — Directorio donde vive docker-compose.yml (default: /opt/app)
#   APP_URL          — URL base de la aplicación (default: http://localhost:3000)
#   HEALTH_ENDPOINT  — Ruta del health check (default: /api/health)
#   COMPOSE_SERVICE  — Nombre del servicio en docker-compose.yml (default: api)
#   CONTAINER_NAME   — Nombre del contenedor Docker (default: api)
#
# REQUISITOS EN EL SERVIDOR:
#   - Docker Engine >= 24
#   - docker compose v2 (plugin, no docker-compose v1)
#   - Usuario con permisos de docker (o sudo configurado sin contraseña)
#   - curl instalado
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colores y helpers de logging
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_section() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE} $*${NC}"; echo -e "${BLUE}========================================${NC}"; }

# ---------------------------------------------------------------------------
# Configuración (sobreescribible por variables de entorno)
# ---------------------------------------------------------------------------
IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"
REGISTRY="${REGISTRY:-ghcr.io}"
REPO="${REPO:-}"                          # Ej: myorg/myapp — REQUERIDO
APP_DIR="${APP_DIR:-/opt/app}"
APP_URL="${APP_URL:-http://localhost:3000}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-/api/health}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-api}"
CONTAINER_NAME="${CONTAINER_NAME:-api}"
HEALTH_MAX_RETRIES="${HEALTH_MAX_RETRIES:-15}"
HEALTH_RETRY_INTERVAL="${HEALTH_RETRY_INTERVAL:-6}"

# ---------------------------------------------------------------------------
# Validaciones previas
# ---------------------------------------------------------------------------
log_section "Validaciones previas"

if [ -z "$REPO" ]; then
  log_error "La variable REPO no está definida. Ej: export REPO=myorg/myapp"
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  log_error "El directorio APP_DIR='$APP_DIR' no existe."
  exit 1
fi

if [ ! -f "$APP_DIR/docker-compose.yml" ] && [ ! -f "$APP_DIR/compose.yml" ]; then
  log_error "No se encontró docker-compose.yml ni compose.yml en '$APP_DIR'."
  exit 1
fi

command -v docker  >/dev/null 2>&1 || { log_error "docker no está instalado."; exit 1; }
command -v curl    >/dev/null 2>&1 || { log_error "curl no está instalado."; exit 1; }
docker compose version >/dev/null 2>&1 || { log_error "docker compose (plugin v2) no está instalado."; exit 1; }

FULL_IMAGE="${REGISTRY}/${REPO}/${COMPOSE_SERVICE}:${IMAGE_TAG}"
log_ok "Configuración validada."
log_info "Imagen objetivo: ${FULL_IMAGE}"
log_info "Directorio app:  ${APP_DIR}"
log_info "Health check:    ${APP_URL}${HEALTH_ENDPOINT}"

# ---------------------------------------------------------------------------
# Guardar imagen anterior para rollback
# ---------------------------------------------------------------------------
log_section "Guardando imagen anterior"

PREVIOUS_IMAGE=""
if docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" >/dev/null 2>&1; then
  PREVIOUS_IMAGE=$(docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)
  log_info "Imagen anterior: ${PREVIOUS_IMAGE:-<ninguna>}"
else
  log_warn "Contenedor '$CONTAINER_NAME' no existe aún. Primera vez de deploy."
fi

# ---------------------------------------------------------------------------
# Función de rollback
# ---------------------------------------------------------------------------
rollback() {
  log_section "ROLLBACK"
  log_error "El health check falló. Iniciando rollback..."

  if [ -z "$PREVIOUS_IMAGE" ]; then
    log_error "No hay imagen anterior para hacer rollback. Deploy cancelado."
    exit 1
  fi

  log_info "Volviendo a imagen: ${PREVIOUS_IMAGE}"

  cd "$APP_DIR"

  # Reemplazar la imagen en el entorno y reiniciar
  export DEPLOY_IMAGE="$PREVIOUS_IMAGE"
  docker compose up -d --no-deps "$COMPOSE_SERVICE" || true

  log_warn "Rollback completado. Verifica el estado del servicio manualmente."
  exit 1
}

# Capturar errores inesperados
trap 'log_error "Script terminó inesperadamente en línea $LINENO."; exit 1' ERR

# ---------------------------------------------------------------------------
# Pull de la nueva imagen
# ---------------------------------------------------------------------------
log_section "Pull de nueva imagen"

log_info "Descargando ${FULL_IMAGE}..."
docker pull "$FULL_IMAGE"
log_ok "Imagen descargada correctamente."

# Etiquetar como latest local si el tag no es latest
if [ "$IMAGE_TAG" != "latest" ]; then
  LOCAL_LATEST="${REGISTRY}/${REPO}/${COMPOSE_SERVICE}:latest"
  docker tag "$FULL_IMAGE" "$LOCAL_LATEST"
  log_info "Imagen etiquetada como: ${LOCAL_LATEST}"
fi

# ---------------------------------------------------------------------------
# Deploy con docker compose (zero-downtime)
# ---------------------------------------------------------------------------
log_section "Deploy con docker compose"

cd "$APP_DIR"

log_info "Actualizando servicio '${COMPOSE_SERVICE}' sin afectar otros servicios..."
export DEPLOY_IMAGE="$FULL_IMAGE"
docker compose pull "$COMPOSE_SERVICE"
docker compose up -d --no-deps "$COMPOSE_SERVICE"

log_ok "Contenedor actualizado."

# ---------------------------------------------------------------------------
# Migraciones Prisma
# ---------------------------------------------------------------------------
log_section "Migraciones Prisma"

log_info "Ejecutando prisma migrate deploy dentro del contenedor..."

# Esperar brevemente a que el contenedor esté listo
sleep 3

if docker exec "$CONTAINER_NAME" pnpm exec prisma migrate deploy; then
  log_ok "Migraciones aplicadas correctamente."
else
  log_error "Las migraciones fallaron."
  rollback
fi

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
log_section "Health Check"

HEALTH_URL="${APP_URL}${HEALTH_ENDPOINT}"
log_info "Verificando: ${HEALTH_URL}"
log_info "Máximo ${HEALTH_MAX_RETRIES} intentos cada ${HEALTH_RETRY_INTERVAL}s..."

count=0
until curl -sf --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; do
  count=$((count + 1))
  if [ "$count" -ge "$HEALTH_MAX_RETRIES" ]; then
    log_error "Health check falló después de $((HEALTH_MAX_RETRIES * HEALTH_RETRY_INTERVAL))s."
    rollback
  fi
  log_info "Intento $count/${HEALTH_MAX_RETRIES} — esperando ${HEALTH_RETRY_INTERVAL}s..."
  sleep "$HEALTH_RETRY_INTERVAL"
done

# ---------------------------------------------------------------------------
# Limpieza de imágenes antiguas (opcional)
# ---------------------------------------------------------------------------
log_section "Limpieza"

log_info "Eliminando imágenes Docker no utilizadas..."
docker image prune -f --filter "until=72h" || log_warn "No se pudo limpiar imágenes (no crítico)."

# ---------------------------------------------------------------------------
# Resumen final
# ---------------------------------------------------------------------------
log_section "Deploy completado exitosamente"

log_ok "Servicio:   ${COMPOSE_SERVICE}"
log_ok "Imagen:     ${FULL_IMAGE}"
log_ok "Timestamp:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log_ok "Health:     ${HEALTH_URL} → OK"

echo ""
log_info "Para ver los logs del servicio:"
echo "  docker compose -f ${APP_DIR}/docker-compose.yml logs -f ${COMPOSE_SERVICE}"

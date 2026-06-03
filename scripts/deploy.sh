#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh — SIDOC · Ubuntu 24 LTS
#
# Deploy de producción con imágenes preconstruidas en GHCR.
# Safe to re-run (idempotente).
#
# Uso:
#   SIDOC_IMAGE_TAG=latest \
#   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET_NAME=xxx \
#   bash scripts/deploy.sh
#
# Nota: variables Vite del frontend se hornean en la imagen desde GitHub Actions.
#
# Dry-run:
#   SIDOC_IMAGE_TAG=latest bash scripts/deploy.sh --dry
#
# Requisitos previos:
#   1. docker login ghcr.io -u <usuario> --password-stdin
#   2. /opt/sidoc/infra/docker-compose.prod.yml existe
#   3. /opt/sidoc/.env.prod se preserva o se genera en el primer deploy
# ==============================================================================

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry|-d) DRY_RUN=1 ;;
    *) printf 'Argumento desconocido: %s\nUso: bash deploy.sh [--dry]\n' "$arg" >&2; exit 1 ;;
  esac
done

APP_DIR="${APP_DIR:-/opt/sidoc}"
COMPOSE_FILE="$APP_DIR/infra/docker-compose.prod.yml"
SIDOC_IMAGE_TAG="${SIDOC_IMAGE_TAG:-latest}"

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY:-}"
GOOGLE_DRIVE_FOLDER_DOCUMENTS="${GOOGLE_DRIVE_FOLDER_DOCUMENTS:-}"
GOOGLE_DRIVE_FOLDER_CONTRACTS="${GOOGLE_DRIVE_FOLDER_CONTRACTS:-}"
GOOGLE_DRIVE_FOLDER_BACKUPS="${GOOGLE_DRIVE_FOLDER_BACKUPS:-}"

DOCKER_IMAGE_PRUNE="${DOCKER_IMAGE_PRUNE:-1}"

C_RESET='\033[0m'
C_BOLD='\033[1m'
C_BLUE='\033[1;34m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[1;31m'
C_CYAN='\033[0;36m'
C_MAGENTA='\033[0;35m'

log()  { printf "\n${C_BLUE}[%s]${C_RESET} %s\n" "$(date '+%H:%M:%S')" "$*"; }
ok()   { printf "  ${C_GREEN}✓${C_RESET} %s\n" "$*"; }
warn() { printf "  ${C_YELLOW}⚠${C_RESET}  %s\n" "$*"; }
fail() { printf "  ${C_RED}✗${C_RESET}  %s\n" "$*"; }
info() { printf "  ${C_BLUE}→${C_RESET} %s\n" "$*"; }
cmd()  { printf "  ${C_CYAN}»${C_RESET} %s\n" "$*"; }
val()  { printf "  ${C_MAGENTA}·${C_RESET} %-30s %s\n" "$1" "$2"; }
die()  { printf "\n${C_RED}ERROR:${C_RESET} %s\n" "$*" >&2; exit 1; }

env_get() {
  local key="$1" file="$2"
  [ -f "$file" ] || { echo ""; return; }
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '"' || echo ""
}

gen_secret() { openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n'; }

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$APP_DIR/.env.prod" "$@"
}

require_r2_creds() {
  local env_file="$APP_DIR/.env.prod"
  [ -z "${R2_ACCOUNT_ID:-}"        ] && R2_ACCOUNT_ID="$(env_get R2_ACCOUNT_ID "$env_file")"
  [ -z "${R2_ACCESS_KEY_ID:-}"     ] && R2_ACCESS_KEY_ID="$(env_get R2_ACCESS_KEY_ID "$env_file")"
  [ -z "${R2_SECRET_ACCESS_KEY:-}" ] && R2_SECRET_ACCESS_KEY="$(env_get R2_SECRET_ACCESS_KEY "$env_file")"
  [ -z "${R2_BUCKET_NAME:-}"       ] && R2_BUCKET_NAME="$(env_get R2_BUCKET_NAME "$env_file")"

  local missing=()
  [ -z "$R2_ACCOUNT_ID" ]        && missing+=("R2_ACCOUNT_ID")
  [ -z "$R2_ACCESS_KEY_ID" ]     && missing+=("R2_ACCESS_KEY_ID")
  [ -z "$R2_SECRET_ACCESS_KEY" ] && missing+=("R2_SECRET_ACCESS_KEY")
  [ -z "$R2_BUCKET_NAME" ]       && missing+=("R2_BUCKET_NAME")

  if [ "${#missing[@]}" -gt 0 ]; then
    die "Faltan credenciales R2 requeridas para producción: ${missing[*]}"
  fi
}

install_docker() {
  if command -v docker &>/dev/null; then
    ok "Docker $(docker --version | sed 's/[^0-9.]*\([0-9][0-9.]*\).*/\1/' | head -1) ya instalado"
    return
  fi

  log "Instalando Docker Engine..."
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg

  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
     https://download.docker.com/linux/ubuntu \
     $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update -qq
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
  ok "Docker instalado"
}

prepare_layout() {
  log "Preparando layout mínimo..."
  sudo mkdir -p "$APP_DIR/infra" "$APP_DIR/scripts" "$APP_DIR/secrets"
  sudo chown -R "$USER:$USER" "$APP_DIR"

  local old_google="$APP_DIR/backend/abogadosoft-service-account.json"
  local new_google="$APP_DIR/secrets/google-service-account.json"
  if [ -f "$old_google" ] && [ ! -f "$new_google" ]; then
    cp "$old_google" "$new_google"
    ok "Credencial Google migrada a $new_google"
  fi

  [ -f "$COMPOSE_FILE" ] || die "No existe $COMPOSE_FILE. Copia infra/docker-compose.prod.yml a esa ruta antes de desplegar."
  ok "Compose encontrado → $COMPOSE_FILE"
}

generate_env() {
  local env_file="$APP_DIR/.env.prod"
  local server_ip postgres_pass jwt_secret jwt_refresh_secret meili_key storage_provider google_service_account_path
  server_ip="$(hostname -I | awk '{print $1}')"

  log "Configurando .env.prod..."

  postgres_pass="$(env_get POSTGRES_PASSWORD "$env_file")"
  [ -z "$postgres_pass" ] && postgres_pass="$(gen_secret | cut -c1-32)"

  jwt_secret="$(env_get JWT_SECRET "$env_file")"
  [ -z "$jwt_secret" ] && jwt_secret="$(gen_secret)"

  jwt_refresh_secret="$(env_get JWT_REFRESH_SECRET "$env_file")"
  [ -z "$jwt_refresh_secret" ] && jwt_refresh_secret="$(gen_secret)"

  meili_key="$(env_get MEILISEARCH_KEY "$env_file")"
  [ -z "$meili_key" ] && meili_key="$(gen_secret | cut -c1-32)"

  storage_provider="r2"

  [ -z "$VITE_LIVEBLOCKS_PUBLIC_KEY" ] && VITE_LIVEBLOCKS_PUBLIC_KEY="$(env_get VITE_LIVEBLOCKS_PUBLIC_KEY "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_DOCUMENTS" ] && GOOGLE_DRIVE_FOLDER_DOCUMENTS="$(env_get GOOGLE_DRIVE_FOLDER_DOCUMENTS "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_CONTRACTS" ] && GOOGLE_DRIVE_FOLDER_CONTRACTS="$(env_get GOOGLE_DRIVE_FOLDER_CONTRACTS "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_BACKUPS"   ] && GOOGLE_DRIVE_FOLDER_BACKUPS="$(env_get GOOGLE_DRIVE_FOLDER_BACKUPS "$env_file")"

  google_service_account_path=""
  if [ -f "$APP_DIR/secrets/google-service-account.json" ]; then
    google_service_account_path="/app/secrets/google-service-account.json"
  fi

  cat > "$env_file" << EOF
# ==============================================================================
# SIDOC — .env.prod (auto-generado por deploy.sh)
# Generado: $(date '+%Y-%m-%d %H:%M:%S') · Servidor: ${server_ip}
# ==============================================================================

SIDOC_IMAGE_TAG="${SIDOC_IMAGE_TAG}"

POSTGRES_PASSWORD="${postgres_pass}"
DATABASE_URL="postgresql://postgres:${postgres_pass}@db:5432/abogadosoft?schema=public"
DIRECT_URL="postgresql://postgres:${postgres_pass}@db:5432/abogadosoft?schema=public"

JWT_SECRET="${jwt_secret}"
JWT_REFRESH_SECRET="${jwt_refresh_secret}"

PORT=4001
NODE_ENV="production"
CORS_ORIGIN="http://${server_ip}"

STORAGE_PROVIDER="${storage_provider}"
MAX_FILE_SIZE_MB=50

R2_ACCOUNT_ID="${R2_ACCOUNT_ID}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
R2_BUCKET_NAME="${R2_BUCKET_NAME}"

GOOGLE_SERVICE_ACCOUNT_PATH="${google_service_account_path}"
GOOGLE_REDIRECT_URI="http://${server_ip}/api/drive/auth/callback"
GOOGLE_DRIVE_FOLDER_DOCUMENTS="${GOOGLE_DRIVE_FOLDER_DOCUMENTS}"
GOOGLE_DRIVE_FOLDER_CONTRACTS="${GOOGLE_DRIVE_FOLDER_CONTRACTS}"
GOOGLE_DRIVE_FOLDER_BACKUPS="${GOOGLE_DRIVE_FOLDER_BACKUPS}"

VITE_API_URL="/api"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY}"

SEARCH_ENGINE="meilisearch"
MEILISEARCH_HOST="http://meilisearch:7700"
MEILISEARCH_KEY="${meili_key}"
EOF

  ok ".env.prod generado → $env_file"
  val "SIDOC_IMAGE_TAG" "$SIDOC_IMAGE_TAG"
}

load_env() {
  set -o allexport
  # shellcheck source=/dev/null
  source "$APP_DIR/.env.prod"
  set +o allexport

  [ -n "${SIDOC_IMAGE_TAG:-}"    ] || die "SIDOC_IMAGE_TAG está vacío en .env.prod"
  [ -n "${JWT_SECRET:-}"         ] || die "JWT_SECRET está vacío en .env.prod"
  [ -n "${DATABASE_URL:-}"       ] || die "DATABASE_URL está vacío en .env.prod"
  [ -n "${POSTGRES_PASSWORD:-}"  ] || die "POSTGRES_PASSWORD está vacío en .env.prod"
  [ -n "${MEILISEARCH_KEY:-}"    ] || die "MEILISEARCH_KEY está vacío en .env.prod"
}

pull_images() {
  log "Descargando imágenes SIDOC ($SIDOC_IMAGE_TAG)..."
  compose pull
  ok "Imágenes descargadas"
}

start_deps() {
  log "Levantando dependencias Docker (db + meilisearch)..."
  compose up -d db meilisearch

  ok "Esperando Postgres..."
  local i=0
  until docker exec abogadosoft_db pg_isready -U postgres -d abogadosoft >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -le 90 ] || die "Postgres no quedó listo tras ~90 intentos (~3m)"
    sleep 2
  done
  ok "Postgres disponible"
}

run_migrations() {
  log "Ejecutando migraciones Prisma desde la imagen backend..."
  local mig_log
  mig_log="$(mktemp)"
  set +e
  compose run --rm backend bunx prisma migrate deploy >"$mig_log" 2>&1
  local mig_ec=$?
  set -euo pipefail
  if [ "$mig_ec" -ne 0 ]; then
    cat "$mig_log" >&2
    rm -f "$mig_log"
    die "prisma migrate deploy falló (código $mig_ec). Revisa el log arriba."
  fi
  cat "$mig_log"
  rm -f "$mig_log"
  ok "Migraciones aplicadas"
}

start_stack() {
  log "Levantando stack..."
  compose up --detach --remove-orphans
  ok "Stack levantado"
}

docker_cleanup_after_deploy() {
  if [ "$DOCKER_IMAGE_PRUNE" = "1" ]; then
    log "Liberando imágenes Docker huérfanas..."
    docker image prune -f || true
    ok "docker image prune ejecutado"
  fi
}

healthcheck() {
  log "Verificando servicios (espera 20s para que arranquen)..."
  sleep 20

  local failed=0
  check() {
    local name="$1" url="$2"
    if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
      ok "$name → $url"
    else
      warn "$name no responde en $url"
      failed=$((failed + 1))
    fi
  }

  check "Backend"     "http://localhost:4001/api/health"
  check "Frontend"    "http://localhost:80"
  check "Meilisearch" "http://localhost:7700/health"

  echo ""
  compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

  if [ "$failed" -gt 0 ]; then
    warn "Algunos servicios aún pueden estar iniciando."
    info "Logs: docker compose -f $COMPOSE_FILE logs --tail=50"
  else
    log "Todos los servicios responden ✓"
  fi
}

run_dry() {
  printf "\n${C_BOLD}${C_CYAN}╔══════════════════════════════════════════════════╗${C_RESET}\n"
  printf "${C_BOLD}${C_CYAN}║  SIDOC · DRY RUN — imágenes GHCR                ║${C_RESET}\n"
  printf "${C_BOLD}${C_CYAN}╚══════════════════════════════════════════════════╝${C_RESET}\n"

  log "[DRY] Prerrequisitos"
  command -v docker &>/dev/null && ok "Docker disponible" || fail "Docker no encontrado"
  command -v curl &>/dev/null && ok "curl disponible" || fail "curl no encontrado"
  command -v openssl &>/dev/null && ok "openssl disponible" || fail "openssl no encontrado"

  log "[DRY] Layout"
  val "APP_DIR" "$APP_DIR"
  val "Compose" "$COMPOSE_FILE"
  val "SIDOC_IMAGE_TAG" "$SIDOC_IMAGE_TAG"
  [ -f "$COMPOSE_FILE" ] && ok "Compose existe" || warn "Compose aún no existe en $COMPOSE_FILE"

  require_r2_creds
  log "[DRY] Comandos principales"
  cmd "docker compose -f $COMPOSE_FILE --env-file $APP_DIR/.env.prod pull"
  cmd "docker compose -f $COMPOSE_FILE --env-file $APP_DIR/.env.prod up -d db meilisearch"
  cmd "docker compose -f $COMPOSE_FILE --env-file $APP_DIR/.env.prod run --rm backend bunx prisma migrate deploy"
  cmd "docker compose -f $COMPOSE_FILE --env-file $APP_DIR/.env.prod up -d --remove-orphans"
  cmd "docker image prune -f  # omitir con DOCKER_IMAGE_PRUNE=0"
}

if [ "$DRY_RUN" -eq 1 ]; then
  run_dry
  exit 0
fi

log "=== SIDOC · Deploy con imágenes GHCR ==="
install_docker
prepare_layout
require_r2_creds
generate_env
load_env
pull_images
start_deps
run_migrations
start_stack
docker_cleanup_after_deploy
healthcheck

log "=== Deploy completo ==="
printf "\n  ${C_GREEN}App disponible en:${C_RESET} http://%s\n\n" \
  "$(hostname -I | awk '{print $1}')"

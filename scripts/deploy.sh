#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh — AbogadoSoft · Ubuntu 24 LTS
#
# One-shot installation. Safe to re-run (idempotente).
#
# Uso básico (mínimo):
#   REPO_URL=https://github.com/ORG/abogado-soft.git bash scripts/deploy.sh
#
# Dry-run (simula sin ejecutar nada):
#   REPO_URL=... bash scripts/deploy.sh --dry
#
# Con credenciales externas opcionales:
#   REPO_URL=... \
#   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET_NAME=xxx \
#   VITE_LIVEBLOCKS_PUBLIC_KEY=pk_prod_xxx \
#   bash scripts/deploy.sh
# ==============================================================================

set -euo pipefail

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry|-d) DRY_RUN=1 ;;
    *) printf 'Argumento desconocido: %s\nUso: bash deploy.sh [--dry]\n' "$arg" >&2; exit 1 ;;
  esac
done

# ─── Variables de entrada ─────────────────────────────────────────────────────
REPO_URL="${REPO_URL:?Falta REPO_URL. Ej: REPO_URL=https://github.com/org/repo.git bash deploy.sh}"
APP_DIR="${APP_DIR:-/opt/abogadosoft}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="$APP_DIR/infra/docker-compose.prod.yml"

# Credenciales externas (opcionales, vacías si no se pasan)
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY:-}"
GOOGLE_DRIVE_FOLDER_DOCUMENTS="${GOOGLE_DRIVE_FOLDER_DOCUMENTS:-}"
GOOGLE_DRIVE_FOLDER_CONTRACTS="${GOOGLE_DRIVE_FOLDER_CONTRACTS:-}"
GOOGLE_DRIVE_FOLDER_BACKUPS="${GOOGLE_DRIVE_FOLDER_BACKUPS:-}"

# ─── Colores ──────────────────────────────────────────────────────────────────
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_BLUE='\033[1;34m'     # info / paso
C_GREEN='\033[1;32m'    # ok / pass
C_YELLOW='\033[1;33m'   # warning
C_RED='\033[1;31m'      # error / fail
C_CYAN='\033[0;36m'     # comando que se ejecutaría
C_MAGENTA='\033[0;35m'  # valor / dato

# ─── Helpers generales ────────────────────────────────────────────────────────
log()  { printf "\n${C_BLUE}[%s]${C_RESET} %s\n" "$(date '+%H:%M:%S')" "$*"; }
ok()   { printf "  ${C_GREEN}✓${C_RESET} %s\n" "$*"; }
warn() { printf "  ${C_YELLOW}⚠${C_RESET}  %s\n" "$*"; }
fail() { printf "  ${C_RED}✗${C_RESET}  %s\n" "$*"; }
info() { printf "  ${C_BLUE}→${C_RESET} %s\n" "$*"; }
cmd()  { printf "  ${C_CYAN}»${C_RESET} %s\n" "$*"; }
val()  { printf "  ${C_MAGENTA}·${C_RESET} %-30s %s\n" "$1" "$2"; }
die()  { printf "\n${C_RED}ERROR:${C_RESET} %s\n" "$*" >&2; exit 1; }

# Lee un valor de un .env file existente; devuelve vacío si no existe
env_get() {
  local key="$1" file="$2"
  [ -f "$file" ] || { echo ""; return; }
  grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '"' || echo ""
}

# Genera un secret seguro de 48 bytes en base64 URL-safe
gen_secret() { openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n'; }

# ─── MODO DRY-RUN ─────────────────────────────────────────────────────────────
# Cada sección verifica el estado real del sistema y reporta lo que pasaría,
# sin ejecutar ningún comando con efectos secundarios.
# ─────────────────────────────────────────────────────────────────────────────

DRY_ERRORS=0   # contador de problemas bloqueantes
DRY_WARNS=0    # contador de advertencias no bloqueantes

dry_error() { fail "$1"; DRY_ERRORS=$((DRY_ERRORS + 1)); }
dry_warn()  { warn "$1"; DRY_WARNS=$((DRY_WARNS + 1)); }

dry_check_prereqs() {
  log "[DRY] PASO 1/7 — Prerrequisitos del sistema"

  local tools=(curl git openssl)
  for t in "${tools[@]}"; do
    if command -v "$t" &>/dev/null; then
      ok "$t disponible ($(command -v "$t"))"
    else
      dry_error "$t NO encontrado — requerido por el script"
    fi
  done

  if command -v docker &>/dev/null; then
    ok "Docker $(docker --version | sed 's/[^0-9.]*\([0-9][0-9.]*\).*/\1/' | head -1) ya instalado"
  else
    info "Docker NO instalado — se instalará via apt-get"
    cmd "sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin"
    if ! command -v sudo &>/dev/null; then
      dry_error "sudo no disponible — necesario para instalar Docker"
    else
      ok "sudo disponible"
    fi
  fi

  if command -v bun &>/dev/null || [ -x "$HOME/.bun/bin/bun" ]; then
    local bun_bin; bun_bin="${HOME}/.bun/bin/bun"
    command -v bun &>/dev/null && bun_bin="$(command -v bun)"
    ok "Bun $($bun_bin --version) ya instalado"
  else
    info "Bun NO instalado — se instalará via curl"
    cmd "curl -fsSL https://bun.sh/install | bash"
  fi

  # Espacio en disco
  local free_kb available_gb app_parent
  app_parent="$(dirname "$APP_DIR")"
  if [ -d "$app_parent" ]; then
    free_kb=$(df -k "$app_parent" 2>/dev/null | awk 'NR==2{print $4}')
    available_gb=$(( free_kb / 1024 / 1024 ))
    if [ "$available_gb" -lt 2 ]; then
      dry_warn "Espacio en disco bajo: ~${available_gb}GB libres en $app_parent (recomendado ≥2GB)"
    else
      ok "Espacio en disco: ~${available_gb}GB libres en $app_parent"
    fi
  else
    info "Directorio padre $app_parent no existe aún — se creará con sudo mkdir"
  fi
}

dry_check_repo() {
  log "[DRY] PASO 2/7 — Repositorio"
  val "URL:"    "$REPO_URL"
  val "Rama:"   "$BRANCH"
  val "Destino:" "$APP_DIR"

  if git ls-remote --exit-code "$REPO_URL" &>/dev/null; then
    ok "Repositorio accesible (git ls-remote OK)"
  else
    dry_error "No se puede acceder al repositorio: $REPO_URL"
    info "Verifica que la URL sea correcta y tengas acceso de red/credenciales SSH"
  fi

  if [ -d "$APP_DIR/.git" ]; then
    local current_branch
    current_branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "desconocida")
    ok "$APP_DIR ya existe (rama: $current_branch)"
    cmd "git fetch origin && git reset --hard origin/$BRANCH && git clean -fd"
  else
    info "$APP_DIR no existe — se clonará"
    cmd "git clone --branch $BRANCH $REPO_URL $APP_DIR"
  fi
}

dry_check_env() {
  log "[DRY] PASO 3/7 — Variables de entorno (.env.prod)"
  local env_file="$APP_DIR/.env.prod"

  if [ -f "$env_file" ]; then
    ok ".env.prod ya existe — se preservarán los valores actuales"

    local fields=(POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET MEILISEARCH_KEY
                  DATABASE_URL STORAGE_PROVIDER R2_ACCOUNT_ID R2_BUCKET_NAME
                  VITE_API_URL VITE_LIVEBLOCKS_PUBLIC_KEY)
    for key in "${fields[@]}"; do
      local val_existing
      val_existing="$(env_get "$key" "$env_file")"
      if [ -n "$val_existing" ]; then
        # Mostrar parcialmente si parece un secret
        local display="$val_existing"
        case "$key" in
          *SECRET*|*PASSWORD*|*KEY*|*ACCESS*)
            display="${val_existing:0:8}…(${#val_existing} chars)"
            ;;
        esac
        ok "$key = $display"
      else
        dry_warn "$key está vacío en .env.prod existente"
      fi
    done
  else
    info ".env.prod NO existe — se generará automáticamente con:"
    local server_ip; server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || echo "DESCONOCIDA")"
    val "POSTGRES_PASSWORD"  "(auto-generado, 32 chars)"
    val "JWT_SECRET"         "(auto-generado, 64 chars)"
    val "JWT_REFRESH_SECRET" "(auto-generado, 64 chars)"
    val "MEILISEARCH_KEY"    "(auto-generado, 32 chars)"
    val "DATABASE_URL"       "postgresql://postgres:***@db:5432/abogadosoft"
    val "CORS_ORIGIN"        "http://${server_ip}"
    val "VITE_API_URL"       "http://${server_ip}/api"

    # Credenciales externas
    local storage_would_be="local"
    if [ -n "$R2_ACCOUNT_ID" ]; then
      storage_would_be="r2"
      val "STORAGE_PROVIDER"    "r2 (detectado R2_ACCOUNT_ID)"
      val "R2_ACCOUNT_ID"       "${R2_ACCOUNT_ID:0:8}…"
      val "R2_BUCKET_NAME"      "${R2_BUCKET_NAME:-VACÍO}"
    else
      val "STORAGE_PROVIDER"    "local (sin R2 creds)"
      dry_warn "R2_ACCOUNT_ID no pasado — se usará almacenamiento local en el servidor"
      info "Para usar Cloudflare R2: pasa R2_ACCOUNT_ID=xxx ... al script"
    fi

    [ -z "$VITE_LIVEBLOCKS_PUBLIC_KEY" ] && \
      dry_warn "VITE_LIVEBLOCKS_PUBLIC_KEY no pasado — edición colaborativa desactivada"

    if [ "$server_ip" = "DESCONOCIDA" ]; then
      dry_warn "No se pudo detectar IP del servidor — CORS_ORIGIN y VITE_API_URL quedarán incorrectos"
      info "En el servidor real, hostname -I detectará la IP correctamente"
    fi
  fi
}

dry_check_migrations() {
  log "[DRY] PASO 4/7 — Migraciones Prisma"

  local migrations_dir="$APP_DIR/backend/prisma/migrations"
  if [ -d "$migrations_dir" ]; then
    local count
    count=$(find "$migrations_dir" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
    ok "$count migración(es) encontrada(s) en $migrations_dir"
    cmd "bunx prisma migrate deploy"
  else
    info "Repo no clonado aún — migraciones se verificarán post-clone"
    cmd "bunx prisma migrate deploy"
  fi

  info "Las migraciones requieren que el contenedor 'db' (Postgres) esté healthy"
}

dry_check_frontend() {
  log "[DRY] PASO 5/7 — Build del frontend"

  local lockfile="$APP_DIR/bun.lock"
  local pkg="$APP_DIR/package.json"

  if [ -f "$pkg" ]; then
    ok "package.json encontrado"
    if [ -f "$lockfile" ]; then
      ok "bun.lock encontrado — se usará --frozen-lockfile"
      cmd "bun install --frozen-lockfile && bun run build"
    else
      dry_warn "bun.lock no encontrado — bun install regenerará el lockfile"
      cmd "bun install && bun run build"
    fi
  else
    info "Repo no clonado aún — build se ejecutará post-clone"
    cmd "bun install --frozen-lockfile && bun run build"
  fi
}

dry_check_stack() {
  log "[DRY] PASO 6/7 — Stack Docker"

  if [ -f "$COMPOSE_FILE" ]; then
    ok "docker-compose.prod.yml encontrado"
    if command -v docker &>/dev/null; then
      # Validar sintaxis del compose (sin ejecutar)
      local validate_out
      if validate_out=$(docker compose -f "$COMPOSE_FILE" config --quiet 2>&1); then
        ok "Sintaxis del compose válida"
      else
        dry_error "Error de sintaxis en compose: $validate_out"
      fi
    fi
    cmd "docker compose -f docker-compose.prod.yml build --no-cache backend"
    cmd "docker compose -f docker-compose.prod.yml up --detach --remove-orphans"
  else
    info "Compose no disponible aún (repo no clonado) — se validará post-clone"
  fi

  # Verificar puertos
  log "[DRY] PASO 6/7 — Verificación de puertos"
  local ports=(80:Frontend 4001:Backend)
  for entry in "${ports[@]}"; do
    local port="${entry%%:*}" svc="${entry##*:}"
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
      dry_warn "Puerto $port ya en uso ($svc) — puede haber conflicto con el contenedor"
    else
      ok "Puerto $port libre ($svc)"
    fi
  done
}

dry_check_healthcheck() {
  log "[DRY] PASO 7/7 — Healthcheck (verificación post-deploy)"
  info "Al finalizar el deploy, se verificarán:"
  cmd "curl http://localhost:4001/api/health   (Backend)"
  cmd "curl http://localhost:80               (Frontend/Nginx)"
  cmd "curl http://localhost:7700/health      (Meilisearch)"
}

dry_summary() {
  printf "\n%s\n" "$(printf '═%.0s' {1..60})"
  printf "${C_BOLD}RESUMEN DRY-RUN${C_RESET}\n"
  printf '%s\n' "$(printf '─%.0s' {1..60})"

  if [ "$DRY_ERRORS" -eq 0 ] && [ "$DRY_WARNS" -eq 0 ]; then
    printf "${C_GREEN}✓ Todo en orden.${C_RESET} El deploy debería completarse sin problemas.\n"
  elif [ "$DRY_ERRORS" -eq 0 ]; then
    printf "${C_YELLOW}⚠ ${DRY_WARNS} advertencia(s).${C_RESET} El deploy puede continuar pero revisa los warnings.\n"
  else
    printf "${C_RED}✗ ${DRY_ERRORS} error(es) bloqueante(s)${C_RESET}"
    [ "$DRY_WARNS" -gt 0 ] && printf " y ${C_YELLOW}${DRY_WARNS} advertencia(s)${C_RESET}"
    printf "\n  Corrige los errores antes de ejecutar el deploy real.\n"
  fi

  printf '%s\n\n' "$(printf '═%.0s' {1..60})"

  if [ "$DRY_ERRORS" -gt 0 ]; then
    exit 1  # salir con error para uso en CI
  fi
}

run_dry() {
  printf "\n${C_BOLD}${C_CYAN}╔══════════════════════════════════════════════════╗${C_RESET}\n"
  printf "${C_BOLD}${C_CYAN}║  AbogadoSoft · DRY RUN — sin cambios reales      ║${C_RESET}\n"
  printf "${C_BOLD}${C_CYAN}╚══════════════════════════════════════════════════╝${C_RESET}\n"

  dry_check_prereqs
  dry_check_repo
  dry_check_env
  dry_check_migrations
  dry_check_frontend
  dry_check_stack
  dry_check_healthcheck
  dry_summary
}

# ─── MODO REAL ────────────────────────────────────────────────────────────────

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

install_bun() {
  if command -v bun &>/dev/null || [ -x "$HOME/.bun/bin/bun" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
    ok "Bun $(bun --version) ya instalado"
    return
  fi

  log "Instalando Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  grep -qxF 'export PATH="$HOME/.bun/bin:$PATH"' "$HOME/.bashrc" \
    || echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.bashrc"
  ok "Bun $(bun --version) instalado"
}

setup_repo() {
  log "Configurando repositorio..."
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    git -C "$APP_DIR" clean -fd
    ok "Repo actualizado → $(git -C "$APP_DIR" rev-parse --short HEAD)"
  else
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER:$USER" "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    ok "Repo clonado → $(git -C "$APP_DIR" rev-parse --short HEAD)"
  fi
}

generate_env() {
  local env_file="$APP_DIR/.env.prod"
  local server_ip
  server_ip="$(hostname -I | awk '{print $1}')"

  log "Configurando .env.prod..."

  local postgres_pass jwt_secret jwt_refresh_secret meili_key storage_provider

  postgres_pass="$(env_get POSTGRES_PASSWORD "$env_file")"
  [ -z "$postgres_pass" ] && postgres_pass="$(gen_secret | cut -c1-32)"

  jwt_secret="$(env_get JWT_SECRET "$env_file")"
  [ -z "$jwt_secret" ] && jwt_secret="$(gen_secret)"

  jwt_refresh_secret="$(env_get JWT_REFRESH_SECRET "$env_file")"
  [ -z "$jwt_refresh_secret" ] && jwt_refresh_secret="$(gen_secret)"

  meili_key="$(env_get MEILISEARCH_KEY "$env_file")"
  [ -z "$meili_key" ] && meili_key="$(gen_secret | cut -c1-32)"

  storage_provider="$(env_get STORAGE_PROVIDER "$env_file")"
  if [ -z "$storage_provider" ]; then
    [ -n "$R2_ACCOUNT_ID" ] && storage_provider="r2" || storage_provider="local"
  fi

  [ -z "$R2_ACCOUNT_ID"          ] && R2_ACCOUNT_ID="$(env_get R2_ACCOUNT_ID "$env_file")"
  [ -z "$R2_ACCESS_KEY_ID"       ] && R2_ACCESS_KEY_ID="$(env_get R2_ACCESS_KEY_ID "$env_file")"
  [ -z "$R2_SECRET_ACCESS_KEY"   ] && R2_SECRET_ACCESS_KEY="$(env_get R2_SECRET_ACCESS_KEY "$env_file")"
  [ -z "$R2_BUCKET_NAME"         ] && R2_BUCKET_NAME="$(env_get R2_BUCKET_NAME "$env_file")"
  [ -z "$VITE_LIVEBLOCKS_PUBLIC_KEY" ] && VITE_LIVEBLOCKS_PUBLIC_KEY="$(env_get VITE_LIVEBLOCKS_PUBLIC_KEY "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_DOCUMENTS" ] && GOOGLE_DRIVE_FOLDER_DOCUMENTS="$(env_get GOOGLE_DRIVE_FOLDER_DOCUMENTS "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_CONTRACTS" ] && GOOGLE_DRIVE_FOLDER_CONTRACTS="$(env_get GOOGLE_DRIVE_FOLDER_CONTRACTS "$env_file")"
  [ -z "$GOOGLE_DRIVE_FOLDER_BACKUPS"   ] && GOOGLE_DRIVE_FOLDER_BACKUPS="$(env_get GOOGLE_DRIVE_FOLDER_BACKUPS "$env_file")"

  cat > "$env_file" << EOF
# ==============================================================================
# AbogadoSoft — .env.prod (auto-generado por deploy.sh)
# Generado: $(date '+%Y-%m-%d %H:%M:%S') · Servidor: ${server_ip}
# ==============================================================================

POSTGRES_PASSWORD="${postgres_pass}"
DATABASE_URL="postgresql://postgres:${postgres_pass}@db:5432/abogadosoft?schema=public"
DIRECT_URL="postgresql://postgres:${postgres_pass}@db:5432/abogadosoft?schema=public"

JWT_SECRET="${jwt_secret}"
JWT_REFRESH_SECRET="${jwt_refresh_secret}"

PORT=4001
NODE_ENV="production"
CORS_ORIGIN="http://${server_ip}"

STORAGE_PROVIDER="${storage_provider}"
STORAGE_PATH="./storage/documents"
MAX_FILE_SIZE_MB=50

R2_ACCOUNT_ID="${R2_ACCOUNT_ID}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
R2_BUCKET_NAME="${R2_BUCKET_NAME}"

GOOGLE_SERVICE_ACCOUNT_PATH="./abogadosoft-service-account.json"
GOOGLE_REDIRECT_URI="http://${server_ip}/api/drive/auth/callback"
GOOGLE_DRIVE_FOLDER_DOCUMENTS="${GOOGLE_DRIVE_FOLDER_DOCUMENTS}"
GOOGLE_DRIVE_FOLDER_CONTRACTS="${GOOGLE_DRIVE_FOLDER_CONTRACTS}"
GOOGLE_DRIVE_FOLDER_BACKUPS="${GOOGLE_DRIVE_FOLDER_BACKUPS}"

VITE_API_URL="http://${server_ip}/api"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY}"

SEARCH_ENGINE="meilisearch"
MEILISEARCH_HOST="http://meilisearch:7700"
MEILISEARCH_KEY="${meili_key}"
EOF

  ok ".env.prod generado → $env_file"
  if [ "$storage_provider" = "r2" ] && [ -z "$R2_ACCOUNT_ID" ]; then
    warn "STORAGE_PROVIDER=r2 pero R2_ACCOUNT_ID está vacío"
  fi
}

load_env() {
  set -o allexport
  # shellcheck source=/dev/null
  source "$APP_DIR/.env.prod"
  set +o allexport

  [ -n "${JWT_SECRET:-}"        ] || die "JWT_SECRET está vacío en .env.prod"
  [ -n "${DATABASE_URL:-}"      ] || die "DATABASE_URL está vacío en .env.prod"
  [ -n "${POSTGRES_PASSWORD:-}" ] || die "POSTGRES_PASSWORD está vacío en .env.prod"
  [ -n "${MEILISEARCH_KEY:-}"   ] || die "MEILISEARCH_KEY está vacío en .env.prod"
}

migrate_db_host_url() {
  # Prisma ejecuta desde el host SSH: necesita llegar por localhost, no por el hostname `db` de Docker DNS.
  local url="${DIRECT_URL:-$DATABASE_URL}"
  printf '%s\n' "${url//@db/@127.0.0.1}"
}

start_deps_for_host_migrations() {
  log "Levantando dependencias Docker para migraciones (db + meilisearch)..."
  cd "$APP_DIR/infra"

  docker compose -f docker-compose.prod.yml \
    --env-file "$APP_DIR/.env.prod" \
    up -d db meilisearch

  ok "Esperando Postgres (localhost:5432)..."
  local i=0
  until docker exec abogadosoft_db pg_isready -U postgres -d abogadosoft >/dev/null 2>&1; do
    i=$((i + 1))
    [ "$i" -le 90 ] || die "Postgres no quedó listo tras ~90 intentos (~3m)"
    sleep 2
  done

  ok "Postgres disponible para migraciones"
}

run_migrations() {
  log "Ejecutando migraciones Prisma..."
  cd "$APP_DIR/backend"
  # Prisma CLI y prisma/config viven en dependencias del backend.
  # Instalarlas antes evita fallos en el primer deploy de servidor limpio.
  bun install --frozen-lockfile

  bun run prisma:generate

  local migrate_url
  migrate_url="$(migrate_db_host_url)"

  DATABASE_URL="$migrate_url" DIRECT_URL="$migrate_url" bunx prisma migrate deploy
  ok "Migraciones aplicadas"
}

build_frontend() {
  log "Compilando frontend Vite..."
  cd "$APP_DIR"
  bun install --frozen-lockfile
  bun run build
  ok "Frontend listo → dist/ ($(du -sh dist/ | cut -f1))"
}

start_stack() {
  log "Construyendo y levantando contenedores..."
  cd "$APP_DIR/infra"
  docker compose -f docker-compose.prod.yml build --no-cache backend
  docker compose -f docker-compose.prod.yml up --detach --remove-orphans
  ok "Stack levantado"
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
  docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

  if [ "$failed" -gt 0 ]; then
    warn "Algunos servicios aún pueden estar iniciando."
    info "Logs: docker compose -f $COMPOSE_FILE logs --tail=50"
  else
    log "Todos los servicios responden ✓"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────
if [ "$DRY_RUN" -eq 1 ]; then
  run_dry
  exit 0
fi

log "=== AbogadoSoft · Deploy en Ubuntu 24 LTS ==="
install_docker
install_bun
setup_repo
generate_env
load_env
start_deps_for_host_migrations
run_migrations
build_frontend
start_stack
healthcheck

log "=== Deploy completo ==="
printf "\n  ${C_GREEN}App disponible en:${C_RESET} http://%s\n\n" \
  "$(hostname -I | awk '{print $1}')"

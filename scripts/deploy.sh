#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh — AbogadoSoft deploy agnóstico
#
# Uso:
#   Primera instalación:  bash scripts/deploy.sh --install
#   Actualizar app:       bash scripts/deploy.sh --update
#   Solo migraciones BD:  bash scripts/deploy.sh --migrate
#   Ver estado:           bash scripts/deploy.sh --status
#
# Requisitos:
#   - .env en la raíz del repo
#   - Ubuntu: Docker Engine + Docker Compose v2 plugin
#   - macOS: Colima + docker-compose clásico (si USE_COLIMA=1)
# ==============================================================================

set -euo pipefail

# Detectar la raíz real del repo cuando el script se ejecuta localmente.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Config ───────────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/TU_ORG/abogado-soft.git}"  # CAMBIAR
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
BRANCH="${BRANCH:-main}"
DB_RESTORED_FLAG="$APP_DIR/.db_restored"
EMBED_ENV_FILES="${EMBED_ENV_FILES:-0}"
USE_COLIMA="${USE_COLIMA:-0}"
SKIP_REPO="${SKIP_REPO:-0}"
SKIP_PRISMA_DIFF="${SKIP_PRISMA_DIFF:-0}"
PRISMA_BASELINED="${PRISMA_BASELINED:-0}"
ALLOW_NPM_FALLBACK="${ALLOW_NPM_FALLBACK:-0}"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }
ok()   { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; }

compose_cmd() {
  local env_file="$APP_DIR/.env"
  (
    if [ -f "$env_file" ]; then
      # shellcheck source=/dev/null
      set -a; source "$env_file"; set +a
    fi

    if [ "$USE_COLIMA" = "1" ]; then
      docker-compose -f "$APP_DIR/infra/docker-compose.prod.yml" "$@"
    else
      docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" "$@"
    fi
  )
}

write_embedded_env_files() {
  [ "$EMBED_ENV_FILES" = "1" ] || return 0

  log "Generando .env automático (overwrite)"

  local env_file="$APP_DIR/.env"

  get_env_value() {
    local key="$1"
    local file="$2"
    if [ -f "$file" ]; then
      grep "^${key}=" "$file" | head -1 | cut -d= -f2- | tr -d '"' || true
    else
      true
    fi
  }

  random_secret() {
    openssl rand -base64 48 | tr -d '\n' | tr '/+' '_-'
  }

  local server_ip="${SERVER_IP:-$(hostname -I | awk '{print $1}')}"
  [ -z "$server_ip" ] && server_ip="127.0.0.1"

  local postgres_password jwt_secret jwt_refresh_secret meili_key
  postgres_password="$(get_env_value "POSTGRES_PASSWORD" "$env_file")"
  [ -z "$postgres_password" ] && postgres_password="$(random_secret)"

  jwt_secret="$(get_env_value "JWT_SECRET" "$env_file")"
  [ -z "$jwt_secret" ] && jwt_secret="$(random_secret)"

  jwt_refresh_secret="$(get_env_value "JWT_REFRESH_SECRET" "$env_file")"
  [ -z "$jwt_refresh_secret" ] && jwt_refresh_secret="$(random_secret)"

  meili_key="$(get_env_value "MEILISEARCH_KEY" "$env_file")"
  [ -z "$meili_key" ] && meili_key="$(random_secret)"

  cat > "$env_file" <<EOF
DATABASE_URL="postgresql://postgres:${postgres_password}@db:5432/abogadosoft?schema=public"
DIRECT_URL="postgresql://postgres:${postgres_password}@db:5432/abogadosoft?schema=public"
JWT_SECRET="${jwt_secret}"
JWT_REFRESH_SECRET="${jwt_refresh_secret}"
PORT=4001
NODE_ENV="production"
CORS_ORIGIN="http://${server_ip}"
STORAGE_PATH="./storage/documents"
MAX_FILE_SIZE_MB=50
STORAGE_PROVIDER="${STORAGE_PROVIDER:-r2}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
VITE_API_URL="http://${server_ip}/api"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY:-}"
SEARCH_ENGINE="${SEARCH_ENGINE:-meilisearch}"
MEILISEARCH_HOST="${MEILISEARCH_HOST:-http://meilisearch:7700}"
MEILISEARCH_KEY="${meili_key}"
POSTGRES_PASSWORD="${postgres_password}"
EOF

  ok "Archivo .env generado automáticamente."
  warn "Revisa credenciales externas (R2, SMTP) si aplican."
}

# ─── 1. Prerrequisitos del sistema ───────────────────────────────────────────
install_prereqs() {
  if [ "$USE_COLIMA" = "1" ]; then
    log "Verificando prerrequisitos para macOS + Colima..."
    command -v docker >/dev/null 2>&1 || die "docker no está instalado."
    command -v docker-compose >/dev/null 2>&1 || die "docker-compose no está instalado."
    command -v colima >/dev/null 2>&1 || die "colima no está instalado."
    command -v bun >/dev/null 2>&1 || die "bun no está instalado."
    command -v node >/dev/null 2>&1 || die "node no está instalado."

    if ! colima status >/dev/null 2>&1; then
      log "Iniciando Colima..."
      colima start
    fi

    ok "Docker: $(docker --version)"
    ok "docker-compose: $(docker-compose --version)"
    ok "Colima listo"
    ok "Bun: $(bun --version)"
    ok "Node.js: $(node --version)"
    log "Prerrequisitos OK"
    return
  fi

  log "Instalando prerrequisitos en Ubuntu 24..."
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends \
    git curl ca-certificates gnupg lsb-release openssl wget apt-transport-https

  # ── Docker Engine (docker-ce, NO docker.io del apt estándar) ───────────────
  if ! command -v docker &>/dev/null; then
    log "Instalando Docker Engine..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"
    warn "Usuario añadido a grupo docker. Puede requerir re-login para surtir efecto."
  else
    ok "Docker ya instalado: $(docker --version)"
  fi

  # ── Docker Compose v2 (plugin) ──────────────────────────────────────────────
  if ! docker compose version &>/dev/null 2>&1; then
    sudo apt-get install -y docker-compose-plugin
  fi
  ok "Docker Compose: $(docker compose version --short)"

  # ── Bun (para prisma migrate deploy fuera de contenedor) ───────────────────
  if ! command -v bun &>/dev/null; then
    log "Instalando Bun..."
    curl -fsSL https://bun.sh/install | bash
    # Añadir al PATH de la sesión actual
    export PATH="$HOME/.bun/bin:$PATH"
    # Persistir en shell profile
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$HOME/.bashrc"
  else
    ok "Bun ya instalado: $(bun --version)"
  fi

  # ── Node.js 20 LTS (para npm run build del frontend) ───────────────────────
  if ! command -v node &>/dev/null; then
    log "Instalando Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    ok "Node.js ya instalado: $(node --version)"
  fi

  log "Prerrequisitos OK"
}

# ─── 2. Clonar o actualizar el repo ──────────────────────────────────────────
setup_repo() {
  if [ "$SKIP_REPO" = "1" ]; then
    log "SKIP_REPO=1 — no se actualiza/clona el repo"
    return
  fi

  if [ -d "$APP_DIR/.git" ]; then
    log "Actualizando repo en $APP_DIR ($BRANCH)..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    git -C "$APP_DIR" clean -fd
  else
    log "Clonando repo en $APP_DIR..."
    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER":"$USER" "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  ok "Repo en $(git -C "$APP_DIR" rev-parse --short HEAD) ($(git -C "$APP_DIR" log -1 --format='%s'))"
}

# ─── 3. Verificar archivos de entorno ────────────────────────────────────────
check_env() {
  [ -f "$APP_DIR/.env" ] || die ".env no existe en la raíz del repo."

  # shellcheck source=/dev/null
  set +u; source "$APP_DIR/.env"; set -u
  [ -z "${JWT_SECRET:-}" ]      && die "JWT_SECRET vacío en .env"
  [ -z "${DATABASE_URL:-}" ]    && die "DATABASE_URL vacío en .env"
  [ -z "${POSTGRES_PASSWORD:-}" ] && die "POSTGRES_PASSWORD vacío en .env"

  ok ".env OK"
}

# ─── 4. Levantar servicios de datos ───────────────────────────────────────────
start_data_services() {
  log "Levantando PostgreSQL y Meilisearch..."
  cd "$APP_DIR/infra"

  compose_cmd up -d db meilisearch

  log "Esperando PostgreSQL (hasta 60s)..."
  for i in $(seq 1 30); do
    if compose_cmd exec -T db pg_isready -U postgres -d abogadosoft -q 2>/dev/null; then
      ok "PostgreSQL listo"
      break
    fi
    sleep 2
    [ "$i" -eq 30 ] && die "PostgreSQL no levantó en 60s. Revisa logs del servicio db"
  done
}

# ─── 5. Restaurar BD desde dump (solo primera vez) ───────────────────────────
restore_db() {
  if [ -f "$DB_RESTORED_FLAG" ]; then
    ok "BD ya restaurada (flag $DB_RESTORED_FLAG existe) — skip"
    return
  fi

  BASELINE_SQL="$APP_DIR/infra/postgres/baseline.sql"
  DATA_IMPORT_SQL="$APP_DIR/infra/postgres/data_import.sql"
  [ -f "$BASELINE_SQL" ] || die "Baseline no encontrado: $BASELINE_SQL"
  [ -f "$DATA_IMPORT_SQL" ] || die "Import de datos no encontrado: $DATA_IMPORT_SQL"

  run_psql() {
    compose_cmd exec -T db psql -U postgres -d abogadosoft
  }

  log "Aplicando baseline PostgreSQL self-hosted..."
  run_psql < "$BASELINE_SQL"
  ok "Baseline aplicado"

  log "Importando datos de negocio..."
  run_psql < "$DATA_IMPORT_SQL"
  ok "Import OK — $(grep -c '^INSERT INTO public\\.' "$DATA_IMPORT_SQL" 2>/dev/null || echo '?') filas"

  touch "$DB_RESTORED_FLAG"
  ok "Restore completo"
}

# ─── 6. Migraciones Prisma ───────────────────────────────────────────────────
run_migrations() {
  log "Ejecutando prisma migrate deploy..."
  cd "$APP_DIR/backend"

  # Forzar URLs desde el archivo .env para evitar valores heredados del entorno.
  local file_direct_url file_database_url
  file_direct_url=$(grep '^DIRECT_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)
  file_database_url=$(grep '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)

  if [ -n "$file_direct_url" ]; then
    export DIRECT_URL="$file_direct_url"
    export DATABASE_URL="$file_direct_url"
  elif [ -n "$file_database_url" ]; then
    unset DIRECT_URL || true
    export DATABASE_URL="$file_database_url"
  else
    die "No se encontró DIRECT_URL ni DATABASE_URL en .env para ejecutar migraciones."
  fi

  # Validar drift entre schema y migrations (opcional; depende de versión Prisma/flags disponibles).
  if [ "$SKIP_PRISMA_DIFF" != "1" ]; then
    if ! "$HOME/.bun/bin/bunx" prisma migrate diff \
      --from-migrations prisma/migrations \
      --to-schema prisma/schema.prisma \
      --exit-code; then
      die "Se detectaron cambios en prisma/schema.prisma sin migración aplicada/commiteada. (Puedes usar SKIP_PRISMA_DIFF=1 si tu flujo es baseline SQL)."
    fi
  else
    warn "SKIP_PRISMA_DIFF=1 — se omite prisma migrate diff"
  fi

  "$HOME/.bun/bin/bun" run prisma:generate
  if "$HOME/.bun/bin/bunx" prisma migrate deploy; then
    ok "Migraciones OK"
    return
  fi

  if [ "$PRISMA_BASELINED" = "1" ]; then
    warn "PRISMA_BASELINED=1 — intentando baselinar historial de migraciones (resolve) sobre una BD no vacía"
    for dir in prisma/migrations/*; do
      [ -d "$dir" ] || continue
      name="$(basename "$dir")"
      "$HOME/.bun/bin/bunx" prisma migrate resolve --applied "$name" || true
    done
    "$HOME/.bun/bin/bunx" prisma migrate status || true
    ok "Baseline de migraciones marcado (resolve)"
    return
  fi

  die "Falló prisma migrate deploy. Si tu BD fue cargada por baseline SQL, usa PRISMA_BASELINED=1."
}

# ─── 7. Build frontend Vite ──────────────────────────────────────────────────
build_frontend() {
  log "Building frontend Vite..."
  cd "$APP_DIR"

  # Exportar variables VITE_ al entorno para el build
  set -o allexport
  # shellcheck source=/dev/null
  source .env
  set +o allexport

  if npm ci --include=dev --prefer-offline --silent; then
    :
  elif [ "$ALLOW_NPM_FALLBACK" = "1" ]; then
    warn "ALLOW_NPM_FALLBACK=1 — npm ci falló; usando npm install --legacy-peer-deps"
    npm install --include=dev --legacy-peer-deps
  else
    die "npm ci falló. Usa ALLOW_NPM_FALLBACK=1 si necesitas fallback temporal en entornos locales."
  fi
  npm run build

  ok "Frontend OK → dist/ ($(du -sh dist/ | cut -f1))"
}

# ─── 8. Levantar app (backend + nginx + meilisearch) ─────────────────────────
start_app() {
  log "Levantando stack de app..."
  cd "$APP_DIR/infra"

  if [ "$USE_COLIMA" = "1" ]; then
    warn "USE_COLIMA=1 — build backend usando node_modules del host para evitar fallos de Bun/Colima en filesystem Docker"
    compose_cmd build --build-arg USE_HOST_NODE_MODULES=1 --no-cache backend
  else
    compose_cmd build --build-arg USE_HOST_NODE_MODULES=0 --no-cache backend
  fi
  compose_cmd up -d

  ok "App stack levantado"
}

# ─── 9. Healthcheck ──────────────────────────────────────────────────────────
healthcheck() {
  log "Verificando servicios (esperar 10s a que levanten)..."
  sleep 10

  check_service() {
    local name="$1" url="$2"
    if curl -sf "$url" > /dev/null 2>&1; then
      ok "$name responde en $url"
    else
      warn "$name NO responde en $url — puede seguir iniciando"
    fi
  }

  check_service "Backend /api/health"  "http://localhost:4001/api/health"
  check_service "Frontend Nginx"       "http://localhost:80"
  check_service "Meilisearch"          "http://localhost:7700/health"
  if compose_cmd exec -T db pg_isready -U postgres -d abogadosoft -q 2>/dev/null; then
    ok "PostgreSQL responde dentro del contenedor"
  else
    warn "PostgreSQL no responde todavía dentro del contenedor"
  fi

  echo ""
  log "Estado contenedores:"
  compose_cmd ps --format "table {{.Name}}\t{{.Status}}"
}

# ─── Modo --status ─────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo "=== App Stack ==="
  compose_cmd ps 2>/dev/null || echo "(no iniciado)"
}

# ─── Entrypoint ──────────────────────────────────────────────────────────────
MODE="${1:---update}"

case "$MODE" in
  --install)
    log "=== INSTALACIÓN COMPLETA en Ubuntu 24 ==="
    install_prereqs
    setup_repo
    write_embedded_env_files
    check_env
    start_data_services
    restore_db
    run_migrations
    build_frontend
    start_app
    healthcheck
    log "=== INSTALACIÓN COMPLETA ==="
    log "App: http://$(hostname -I | awk '{print $1}')"
    echo ""
    warn "PASO MANUAL PENDIENTE: reindexar Meilisearch (índice vacío tras restore):"
    warn "  docker exec abogadosoft_backend bun src/scripts/reindex.ts"
    warn "  (o cambiar SEARCH_ENGINE=prisma en .env para omitir Meilisearch)"
    ;;

  --update)
    log "=== ACTUALIZACIÓN ==="
    setup_repo
    write_embedded_env_files
    check_env
    start_data_services
    run_migrations
    build_frontend
    start_app
    healthcheck
    log "=== ACTUALIZACIÓN COMPLETA ==="
    ;;

  --migrate)
    log "=== SOLO MIGRACIONES ==="
    write_embedded_env_files
    check_env
    start_data_services
    run_migrations
    ok "Migraciones aplicadas"
    ;;

  --status)
    show_status
    ;;

  *)
    echo "Uso: $0 [--install | --update | --migrate | --status]"
    echo ""
    echo "  --install   Primera instalación completa en servidor limpio Ubuntu 24"
    echo "  --update    Actualizar código + migraciones + rebuild (deploys posteriores)"
    echo "  --migrate   Solo correr prisma migrate deploy"
    echo "  --status    Ver estado de todos los contenedores"
    echo ""
    echo "Variables opcionales:"
    echo "  EMBED_ENV_FILES=1    Sobrescribe .env con plantilla embebida"
    echo "  USE_COLIMA=1         Usa Colima + docker-compose clásico en macOS"
    echo "  SKIP_REPO=1          No hace git fetch/reset/clone (útil en dev local)"
    echo "  SKIP_PRISMA_DIFF=1   Omite prisma migrate diff"
    echo "  PRISMA_BASELINED=1   Marca migraciones como aplicadas en BD no vacía"
    echo "  ALLOW_NPM_FALLBACK=1 Usa npm install --legacy-peer-deps si npm ci falla"
    exit 1
    ;;
esac

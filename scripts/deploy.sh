#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh — AbogadoSoft en Ubuntu 24 LTS
#
# Uso:
#   Primera instalación:  bash scripts/deploy.sh --install
#   Actualizar app:       bash scripts/deploy.sh --update
#   Solo migraciones BD:  bash scripts/deploy.sh --migrate
#   Ver estado:           bash scripts/deploy.sh --status
#
# Requisitos:
#   - Ubuntu 24 LTS
#   - .env en la raíz del repo
# ==============================================================================

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/TU_ORG/abogado-soft.git}"  # CAMBIAR
APP_DIR="${APP_DIR:-/opt/abogadosoft}"
BRANCH="${BRANCH:-main}"
DB_RESTORED_FLAG="$APP_DIR/.db_restored"
EMBED_ENV_FILES="${EMBED_ENV_FILES:-0}"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }
ok()   { echo "[OK] $*"; }
warn() { echo "[WARN] $*"; }

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

  docker compose -f docker-compose.prod.yml up -d db meilisearch

  log "Esperando PostgreSQL (hasta 60s)..."
  for i in $(seq 1 30); do
    if docker compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres -d abogadosoft -q 2>/dev/null; then
      ok "PostgreSQL listo"
      break
    fi
    sleep 2
    [ "$i" -eq 30 ] && die "PostgreSQL no levantó en 60s. Revisa: docker compose -f docker-compose.prod.yml logs db"
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
    docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" exec -T db \
      psql -U postgres -d abogadosoft
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

  # Usar DIRECT_URL para migraciones si está definido.
  # Si no existe, conservar DATABASE_URL ya cargado desde .env.
  local direct_url=""
  direct_url=$(grep '^DIRECT_URL=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$direct_url" ]; then
    export DATABASE_URL="$direct_url"
  elif [ -n "${DATABASE_URL:-}" ]; then
    export DATABASE_URL
  else
    die "No se encontró DIRECT_URL ni DATABASE_URL en .env para ejecutar migraciones."
  fi

  # Validar que el schema no tenga drift frente al historial de migraciones.
  # Si hay diferencias, probablemente faltó crear/commitear una migración.
  if ! "$HOME/.bun/bin/bunx" prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "$DATABASE_URL" \
    --exit-code; then
    die "Se detectaron cambios en prisma/schema.prisma sin migración aplicada/commiteada."
  fi

  "$HOME/.bun/bin/bun" run prisma:generate
  "$HOME/.bun/bin/bunx" prisma migrate deploy

  ok "Migraciones OK"
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

  npm ci --prefer-offline --silent
  npm run build

  ok "Frontend OK → dist/ ($(du -sh dist/ | cut -f1))"
}

# ─── 8. Levantar app (backend + nginx + meilisearch) ─────────────────────────
start_app() {
  log "Levantando stack de app..."
  cd "$APP_DIR/infra"

  docker compose -f docker-compose.prod.yml build --no-cache backend
  docker compose -f docker-compose.prod.yml up -d

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
  if docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" exec -T db pg_isready -U postgres -d abogadosoft -q 2>/dev/null; then
    ok "PostgreSQL responde dentro del contenedor"
  else
    warn "PostgreSQL no responde todavía dentro del contenedor"
  fi

  echo ""
  log "Estado contenedores:"
  docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" ps --format "table {{.Name}}\t{{.Status}}"
}

# ─── Modo --status ─────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo "=== App Stack ==="
  docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" ps 2>/dev/null || echo "(no iniciado)"
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
    exit 1
    ;;
esac

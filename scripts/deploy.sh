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
#   - .env.prod en la raíz del repo (copiar de .env.prod.example)
#   - infra/supabase/.env (copiar de infra/supabase/.env.example)
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

  log "Generando .env.prod e infra/supabase/.env automáticos (overwrite)"
  mkdir -p "$APP_DIR/infra/supabase"

  local env_prod_file="$APP_DIR/.env.prod"
  local supabase_env_file="$APP_DIR/infra/supabase/.env"

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

  jwt_for_role() {
    local role="$1"
    local secret="$2"
    node - "$role" "$secret" <<'EOF'
const crypto = require("node:crypto");
const role = process.argv[2];
const secret = process.argv[3];
const now = Math.floor(Date.now() / 1000);
const payload = { role, iss: "supabase", iat: now, exp: now + (60 * 60 * 24 * 365 * 10) };
const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const header = enc({ alg: "HS256", typ: "JWT" });
const body = enc(payload);
const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
process.stdout.write(`${header}.${body}.${sig}`);
EOF
  }

  local server_ip="${SERVER_IP:-$(hostname -I | awk '{print $1}')}"
  [ -z "$server_ip" ] && server_ip="127.0.0.1"

  local postgres_password jwt_secret dashboard_password meili_key
  postgres_password="$(get_env_value "POSTGRES_PASSWORD" "$env_prod_file")"
  [ -z "$postgres_password" ] && postgres_password="$(get_env_value "POSTGRES_PASSWORD" "$supabase_env_file")"
  [ -z "$postgres_password" ] && postgres_password="$(random_secret)"

  jwt_secret="$(get_env_value "JWT_SECRET" "$env_prod_file")"
  [ -z "$jwt_secret" ] && jwt_secret="$(get_env_value "JWT_SECRET" "$supabase_env_file")"
  [ -z "$jwt_secret" ] && jwt_secret="$(random_secret)"

  dashboard_password="$(get_env_value "DASHBOARD_PASSWORD" "$env_prod_file")"
  [ -z "$dashboard_password" ] && dashboard_password="$(get_env_value "DASHBOARD_PASSWORD" "$supabase_env_file")"
  [ -z "$dashboard_password" ] && dashboard_password="$(random_secret)"

  meili_key="$(get_env_value "MEILISEARCH_KEY" "$env_prod_file")"
  [ -z "$meili_key" ] && meili_key="$(random_secret)"

  local anon_key service_role_key
  anon_key="$(get_env_value "ANON_KEY" "$env_prod_file")"
  [ -z "$anon_key" ] && anon_key="$(get_env_value "ANON_KEY" "$supabase_env_file")"
  [ -z "$anon_key" ] && anon_key="$(jwt_for_role "anon" "$jwt_secret")"

  service_role_key="$(get_env_value "SERVICE_ROLE_KEY" "$env_prod_file")"
  [ -z "$service_role_key" ] && service_role_key="$(get_env_value "SERVICE_ROLE_KEY" "$supabase_env_file")"
  [ -z "$service_role_key" ] && service_role_key="$(jwt_for_role "service_role" "$jwt_secret")"

  cat > "$env_prod_file" <<EOF
DATABASE_URL="postgresql://postgres:${postgres_password}@supabase_db:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:${postgres_password}@supabase_db:5432/postgres?schema=public"
SUPABASE_URL="http://${server_ip}:8000"
SUPABASE_ANON_KEY="${anon_key}"
SUPABASE_SERVICE_ROLE_KEY="${service_role_key}"
SUPABASE_JWT_SECRET="${jwt_secret}"
PORT=4001
NODE_ENV="production"
CORS_ORIGIN="http://${server_ip}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
GOOGLE_REDIRECT_URI="http://${server_ip}/api/drive/auth/callback"
GOOGLE_SERVICE_ACCOUNT_PATH="${GOOGLE_SERVICE_ACCOUNT_PATH:-./abogadosoft-service-account.json}"
GOOGLE_DRIVE_FOLDER_DOCUMENTS="${GOOGLE_DRIVE_FOLDER_DOCUMENTS:-}"
GOOGLE_DRIVE_FOLDER_CONTRACTS="${GOOGLE_DRIVE_FOLDER_CONTRACTS:-}"
GOOGLE_DRIVE_FOLDER_BACKUPS="${GOOGLE_DRIVE_FOLDER_BACKUPS:-}"
STORAGE_PATH="./storage/documents"
MAX_FILE_SIZE_MB=50
STORAGE_PROVIDER="${STORAGE_PROVIDER:-r2}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
VITE_API_URL="http://${server_ip}/api"
VITE_SUPABASE_URL="http://${server_ip}:8000"
VITE_SUPABASE_ANON_KEY="${anon_key}"
VITE_LIVEBLOCKS_PUBLIC_KEY="${VITE_LIVEBLOCKS_PUBLIC_KEY:-}"
SEARCH_ENGINE="${SEARCH_ENGINE:-meilisearch}"
MEILISEARCH_HOST="${MEILISEARCH_HOST:-http://meilisearch:7700}"
MEILISEARCH_KEY="${meili_key}"
POSTGRES_PASSWORD="${postgres_password}"
JWT_SECRET="${jwt_secret}"
ANON_KEY="${anon_key}"
SERVICE_ROLE_KEY="${service_role_key}"
DASHBOARD_USERNAME="${DASHBOARD_USERNAME:-admin}"
DASHBOARD_PASSWORD="${dashboard_password}"
SMTP_ADMIN_EMAIL="${SMTP_ADMIN_EMAIL:-admin@${server_ip}.local}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_SENDER_NAME="${SMTP_SENDER_NAME:-AbogadoSoft}"
EOF

  cat > "$supabase_env_file" <<EOF
POSTGRES_PASSWORD=${postgres_password}
JWT_SECRET=${jwt_secret}
ANON_KEY=${anon_key}
SERVICE_ROLE_KEY=${service_role_key}
PGRST_DB_SCHEMAS=public
SITE_URL=http://${server_ip}:3000
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://${server_ip}:8000
SMTP_ADMIN_EMAIL=${SMTP_ADMIN_EMAIL:-admin@${server_ip}.local}
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_SENDER_NAME=${SMTP_SENDER_NAME:-AbogadoSoft}
ENABLE_EMAIL_CONFIRMATIONS=false
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
GOOGLE_REDIRECT_URI=http://${server_ip}:8000/auth/v1/callback
STUDIO_DEFAULT_ORGANIZATION=${STUDIO_DEFAULT_ORGANIZATION:-AbogadoSoft}
STUDIO_DEFAULT_PROJECT=${STUDIO_DEFAULT_PROJECT:-AbogadoSoft}
DASHBOARD_USERNAME=${DASHBOARD_USERNAME:-admin}
DASHBOARD_PASSWORD=${dashboard_password}
STORAGE_BACKEND=${STORAGE_BACKEND:-file}
FILE_SIZE_LIMIT=${FILE_SIZE_LIMIT:-52428800}
LOGFLARE_LOGGER_BACKEND_API_KEY=${LOGFLARE_LOGGER_BACKEND_API_KEY:-}
LOGFLARE_API_KEY=${LOGFLARE_API_KEY:-}
EOF

  ok "Archivos de entorno generados automáticamente."
  warn "Revisa credenciales externas (Google, R2, SMTP) si aplican."
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

  # ── docker compose v2 (plugin) ─────────────────────────────────────────────
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
  [ -f "$APP_DIR/.env.prod" ] || die ".env.prod no existe. Copia .env.prod.example → .env.prod y completa los valores."
  [ -f "$APP_DIR/infra/supabase/.env" ] || die "infra/supabase/.env no existe. Copia infra/supabase/.env.example → infra/supabase/.env y completa."

  # Validar vars críticas
  # shellcheck source=/dev/null
  set +u; source "$APP_DIR/.env.prod"; set -u
  [ -z "${SUPABASE_JWT_SECRET:-}" ] && die "SUPABASE_JWT_SECRET vacío en .env.prod"
  [ -z "${DATABASE_URL:-}" ]        && die "DATABASE_URL vacío en .env.prod"
  [ -z "${POSTGRES_PASSWORD:-}" ]   && die "POSTGRES_PASSWORD vacío en .env.prod"

  ok ".env.prod y infra/supabase/.env OK"
}

# ─── 4. Levantar Supabase self-hosted ────────────────────────────────────────
start_supabase() {
  log "Levantando Supabase self-hosted..."
  cd "$APP_DIR/infra/supabase"

  docker compose pull --quiet
  docker compose up -d

  # Esperar a que Postgres esté listo
  log "Esperando Postgres (hasta 60s)..."
  for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U postgres -h localhost -q 2>/dev/null; then
      ok "Postgres listo"
      break
    fi
    sleep 2
    [ "$i" -eq 30 ] && die "Postgres no levantó en 60s. Revisa: docker compose logs db"
  done

  # Esperar a que Kong esté listo
  log "Esperando Kong API Gateway (hasta 30s)..."
  for i in $(seq 1 15); do
    if docker compose exec -T kong kong health &>/dev/null 2>&1; then
      ok "Kong listo"
      break
    fi
    sleep 2
    [ "$i" -eq 15 ] && warn "Kong no reportó healthy — puede seguir iniciando"
  done
}

# ─── 5. Restaurar BD desde dumps (solo primera vez) ──────────────────────────
# Orden obligatorio: auth → storage → public
# public.users tiene FK a auth.users; restaurar public primero falla.
restore_db() {
  if [ -f "$DB_RESTORED_FLAG" ]; then
    ok "BD ya restaurada (flag $DB_RESTORED_FLAG existe) — skip"
    return
  fi

  AUTH_DUMP="$APP_DIR/infra/db/auth_dump.sql"
  STORAGE_DUMP="$APP_DIR/infra/db/storage_dump.sql"
  PUBLIC_DUMP="$APP_DIR/infra/db/full_dump.sql"

  [ -f "$AUTH_DUMP" ]    || die "Dump no encontrado: $AUTH_DUMP"
  [ -f "$STORAGE_DUMP" ] || die "Dump no encontrado: $STORAGE_DUMP"
  [ -f "$PUBLIC_DUMP" ]  || die "Dump no encontrado: $PUBLIC_DUMP"

  run_psql() {
    docker compose -f "$APP_DIR/infra/supabase/docker-compose.yml" exec -T db \
      psql -U postgres -d postgres
  }

  log "Restaurando schema auth (usuarios + identidades Google)..."
  run_psql < "$AUTH_DUMP"
  ok "auth OK — $(grep -c '^INSERT' "$AUTH_DUMP") filas"

  log "Restaurando schema storage..."
  run_psql < "$STORAGE_DUMP"
  ok "storage OK"

  log "Restaurando schema public (datos de negocio)..."
  run_psql < "$PUBLIC_DUMP"
  ok "public OK — $(grep -c '^INSERT' "$PUBLIC_DUMP" 2>/dev/null || echo '?') filas"

  touch "$DB_RESTORED_FLAG"
  ok "Restore completo 1:1"
}

# ─── 6. Migraciones Prisma ───────────────────────────────────────────────────
run_migrations() {
  log "Ejecutando prisma migrate deploy..."
  cd "$APP_DIR/backend"

  # Usar DIRECT_URL para migraciones (sin pgBouncer) si está definido.
  # Si no existe, conservar DATABASE_URL ya cargado desde .env.prod.
  local direct_url=""
  direct_url=$(grep '^DIRECT_URL=' "$APP_DIR/.env.prod" | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$direct_url" ]; then
    export DATABASE_URL="$direct_url"
  elif [ -n "${DATABASE_URL:-}" ]; then
    export DATABASE_URL
  else
    die "No se encontró DIRECT_URL ni DATABASE_URL en .env.prod para ejecutar migraciones."
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
  source .env.prod
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
  check_service "Supabase Kong"        "http://localhost:8000/health"
  check_service "Supabase Studio"      "http://localhost:3001"

  echo ""
  log "Estado contenedores Supabase:"
  docker compose -f "$APP_DIR/infra/supabase/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}"
  echo ""
  log "Estado contenedores App:"
  docker compose -f "$APP_DIR/infra/docker-compose.prod.yml" ps --format "table {{.Name}}\t{{.Status}}"
}

# ─── Modo --status ─────────────────────────────────────────────────────────
show_status() {
  echo ""
  echo "=== Supabase Stack ==="
  docker compose -f "$APP_DIR/infra/supabase/docker-compose.yml" ps 2>/dev/null || echo "(no iniciado)"
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
    start_supabase
    restore_db
    run_migrations
    build_frontend
    start_app
    healthcheck
    log "=== INSTALACIÓN COMPLETA ==="
    log "Studio Supabase: http://$(hostname -I | awk '{print $1}'):3001"
    log "App:             http://$(hostname -I | awk '{print $1}')"
    echo ""
    warn "PASO MANUAL PENDIENTE: reindexar Meilisearch (índice vacío tras restore):"
    warn "  docker exec abogadosoft_backend bun src/scripts/reindex.ts"
    warn "  (o cambiar SEARCH_ENGINE=prisma en .env.prod para omitir Meilisearch)"
    ;;

  --update)
    log "=== ACTUALIZACIÓN ==="
    setup_repo
    write_embedded_env_files
    check_env
    start_supabase
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
    echo "  EMBED_ENV_FILES=1    Sobrescribe .env.prod e infra/supabase/.env con plantillas embebidas"
    exit 1
    ;;
esac

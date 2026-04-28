#!/usr/bin/env bash
# ==============================================================================
# scripts/r2-clean.sh — Limpiar bucket Cloudflare R2 (TEMPORAL)
#
# Elimina TODOS los objetos del bucket R2. El bucket en sí no se elimina.
# Lee credenciales automáticamente de backend/.env o .env (raíz).
#
# Uso:
#   bash scripts/r2-clean.sh                   # lee .env automáticamente
#   bash scripts/r2-clean.sh --dry             # muestra qué borraría sin borrar nada
#
# O con credenciales explícitas:
#   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx \
#   R2_BUCKET_NAME=xxx bash scripts/r2-clean.sh
# ==============================================================================

set -euo pipefail

# ─── Flags ────────────────────────────────────────────────────────────────────
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry|-d) DRY_RUN=1 ;;
    *) printf 'Argumento desconocido: %s\nUso: bash r2-clean.sh [--dry]\n' "$arg" >&2; exit 1 ;;
  esac
done

# ─── Colores ──────────────────────────────────────────────────────────────────
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_BLUE='\033[1;34m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[1;31m'
C_CYAN='\033[0;36m'
C_MAGENTA='\033[0;35m'

log()   { printf "\n${C_BLUE}[%s]${C_RESET} %s\n" "$(date '+%H:%M:%S')" "$*"; }
ok()    { printf "  ${C_GREEN}✓${C_RESET}  %s\n" "$*"; }
warn()  { printf "  ${C_YELLOW}⚠${C_RESET}  %s\n" "$*"; }
fail()  { printf "  ${C_RED}✗${C_RESET}  %s\n" "$*"; }
info()  { printf "  ${C_BLUE}→${C_RESET} %s\n" "$*"; }
die()   { printf "\n${C_RED}ERROR:${C_RESET} %s\n" "$*" >&2; exit 1; }
dryop() { printf "  ${C_CYAN}[DRY]${C_RESET} %s\n" "$*"; }

# ─── Leer credenciales ────────────────────────────────────────────────────────
# Prioridad: vars de entorno > backend/.env > .env raíz

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  # shellcheck source=/dev/null
  set -o allexport
  source "$file"
  set +o allexport
}

# Solo cargar si las vars no vienen ya del entorno
if [ -z "${R2_ACCOUNT_ID:-}" ]; then
  if [ -f "$REPO_ROOT/backend/.env" ]; then
    load_env_file "$REPO_ROOT/backend/.env"
    info "Credenciales leídas desde backend/.env"
  elif [ -f "$REPO_ROOT/.env" ]; then
    load_env_file "$REPO_ROOT/.env"
    info "Credenciales leídas desde .env"
  fi
fi

# ─── Validar credenciales ─────────────────────────────────────────────────────
[ -n "${R2_ACCOUNT_ID:-}"        ] || die "R2_ACCOUNT_ID no definido"
[ -n "${R2_ACCESS_KEY_ID:-}"     ] || die "R2_ACCESS_KEY_ID no definido"
[ -n "${R2_SECRET_ACCESS_KEY:-}" ] || die "R2_SECRET_ACCESS_KEY no definido"
[ -n "${R2_BUCKET_NAME:-}"       ] || die "R2_BUCKET_NAME no definido"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# ─── Verificar AWS CLI ────────────────────────────────────────────────────────
check_aws_cli() {
  if command -v aws &>/dev/null; then
    ok "AWS CLI $(aws --version 2>&1 | awk '{print $1}')"
    return
  fi

  warn "AWS CLI no encontrado — intentando instalar..."
  if command -v brew &>/dev/null; then
    brew install awscli --quiet
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y awscli -qq
  elif command -v pip3 &>/dev/null; then
    pip3 install awscli --quiet
  else
    die "No se pudo instalar AWS CLI. Instálalo manualmente: https://aws.amazon.com/cli/"
  fi
  ok "AWS CLI instalado: $(aws --version 2>&1 | awk '{print $1}')"
}

# ─── Wrapper aws con credenciales R2 ─────────────────────────────────────────
r2() {
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION="auto" \
  aws --endpoint-url "$R2_ENDPOINT" "$@"
}

# ─── Listar objetos del bucket ────────────────────────────────────────────────
list_objects() {
  r2 s3api list-objects-v2 \
    --bucket "$R2_BUCKET_NAME" \
    --query 'Contents[].{Key:Key,Size:Size}' \
    --output json 2>/dev/null || echo "[]"
}

# ─── Mostrar resumen del bucket ───────────────────────────────────────────────
show_bucket_summary() {
  log "Analizando bucket: ${C_MAGENTA}${R2_BUCKET_NAME}${C_RESET}"
  info "Endpoint: $R2_ENDPOINT"

  local objects_json
  objects_json="$(list_objects)"

  local count total_bytes
  count=$(echo "$objects_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if d else 0)" 2>/dev/null || echo "0")
  total_bytes=$(echo "$objects_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(x['Size'] for x in d) if d else 0)" 2>/dev/null || echo "0")

  if [ "$count" -eq 0 ]; then
    ok "El bucket ya está vacío — nada que limpiar"
    exit 0
  fi

  local total_mb
  total_mb=$(echo "$total_bytes" | awk '{printf "%.2f", $1/1024/1024}')

  printf "\n  ${C_BOLD}Objetos encontrados:${C_RESET} %s\n" "$count"
  printf "  ${C_BOLD}Tamaño total:${C_RESET}       %s MB (%s bytes)\n" "$total_mb" "$total_bytes"

  # Mostrar muestra de los primeros 20
  if [ "$count" -le 20 ]; then
    echo ""
    echo "$objects_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data:
    for item in data:
        size_kb = item['Size'] / 1024
        print(f\"  \033[0;35m·\033[0m {item['Key']:<60} ({size_kb:.1f} KB)\")
" 2>/dev/null || true
  else
    # Muestra los primeros 10 y los últimos 5
    echo ""
    echo "$objects_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data:
    sample = data[:10]
    for item in sample:
        size_kb = item['Size'] / 1024
        print(f\"  \033[0;35m·\033[0m {item['Key']:<60} ({size_kb:.1f} KB)\")
    remaining = len(data) - 10
    if remaining > 0:
        print(f\"  \033[1;33m  ... y {remaining} objetos más\033[0m\")
" 2>/dev/null || true
  fi

  echo ""

  # Devolver el conteo para uso posterior
  echo "$count" > /tmp/r2_object_count
}

# ─── Borrar todos los objetos ─────────────────────────────────────────────────
delete_all_objects() {
  log "Eliminando todos los objetos de '${R2_BUCKET_NAME}'..."

  # aws s3 rm con --recursive es la forma más eficiente
  r2 s3 rm "s3://${R2_BUCKET_NAME}" --recursive

  ok "Todos los objetos eliminados"
}

# ─── Verificar que quedó vacío ────────────────────────────────────────────────
verify_empty() {
  log "Verificando que el bucket quedó vacío..."

  local objects_json count
  objects_json="$(list_objects)"
  count=$(echo "$objects_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if d else 0)" 2>/dev/null || echo "0")

  if [ "$count" -eq 0 ]; then
    ok "Bucket '${R2_BUCKET_NAME}' completamente limpio ✓"
  else
    warn "$count objeto(s) aún presentes — puede haber fallado alguna eliminación"
    info "Intenta correr el script de nuevo"
    exit 1
  fi
}

# ─── Confirmación interactiva ─────────────────────────────────────────────────
ask_confirmation() {
  local count="${1:-?}"
  printf "\n"
  printf "${C_YELLOW}╔══════════════════════════════════════════════════════╗${C_RESET}\n"
  printf "${C_YELLOW}║  ⚠  ATENCIÓN: OPERACIÓN DESTRUCTIVA E IRREVERSIBLE  ║${C_RESET}\n"
  printf "${C_YELLOW}╚══════════════════════════════════════════════════════╝${C_RESET}\n"
  printf "\n"
  printf "  Se eliminarán ${C_RED}${C_BOLD}%s objetos${C_RESET} del bucket ${C_MAGENTA}%s${C_RESET}.\n" "$count" "$R2_BUCKET_NAME"
  printf "  Esta acción ${C_RED}no se puede deshacer${C_RESET}.\n\n"
  printf "  Escribe ${C_BOLD}CONFIRMAR${C_RESET} para continuar (cualquier otra cosa cancela): "

  local input
  read -r input

  if [ "$input" != "CONFIRMAR" ]; then
    printf "\n${C_YELLOW}  Cancelado.${C_RESET} No se eliminó nada.\n\n"
    exit 0
  fi
  echo ""
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  printf "\n${C_BOLD}${C_RED}╔═══════════════════════════════════════════╗${C_RESET}\n"
  printf "${C_BOLD}${C_RED}║  R2 Cleanup — AbogadoSoft / Cloudflare    ║${C_RESET}\n"
  [ "$DRY_RUN" -eq 1 ] && \
  printf "${C_BOLD}${C_CYAN}║  MODO: DRY RUN — sin cambios reales       ║${C_RESET}\n"
  printf "${C_BOLD}${C_RED}╚═══════════════════════════════════════════╝${C_RESET}\n"

  check_aws_cli
  show_bucket_summary

  local count=0
  [ -f /tmp/r2_object_count ] && count=$(cat /tmp/r2_object_count) && rm -f /tmp/r2_object_count

  if [ "$DRY_RUN" -eq 1 ]; then
    dryop "Se ejecutaría: aws s3 rm s3://${R2_BUCKET_NAME} --recursive"
    dryop "Objetos que se borrarían: $count"
    printf "\n  ${C_CYAN}Dry-run completo. Nada fue modificado.${C_RESET}\n\n"
    exit 0
  fi

  ask_confirmation "$count"
  delete_all_objects
  verify_empty

  printf "\n  ${C_GREEN}${C_BOLD}Bucket '${R2_BUCKET_NAME}' limpio.${C_RESET}\n\n"
}

main

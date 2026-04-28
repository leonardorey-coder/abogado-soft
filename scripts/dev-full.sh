#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ROOT_DIR/.env.local" ]; then
  ENV_FILE="$ROOT_DIR/.env.local"
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$ROOT_DIR/infra/docker-compose.prod.yml" "$@"
    return
  fi

  docker compose -f "$ROOT_DIR/infra/docker-compose.prod.yml" "$@"
}

ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if command -v colima >/dev/null 2>&1; then
    colima start
  fi

  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  echo "Docker no está disponible para dev:full" >&2
  exit 1
}

cleanup() {
  compose_cmd stop "${services[@]}" >/dev/null 2>&1 || true
}

services=(db)
if [ "${SEARCH_ENGINE:-prisma}" = "meilisearch" ]; then
  services+=(meilisearch)
fi

trap cleanup EXIT

ensure_docker
compose_cmd up -d --force-recreate "${services[@]}"

for _ in $(seq 1 30); do
  if compose_cmd exec -T db pg_isready -U postgres -d abogadosoft -q 2>/dev/null; then
    break
  fi
  sleep 1
done

cd "$ROOT_DIR"
(
  cd "$ROOT_DIR/backend"
  bunx prisma generate >/dev/null
)

bunx concurrently --kill-others --names "web,api" "vite --port 3000 --strictPort" "cd backend && bun run dev"

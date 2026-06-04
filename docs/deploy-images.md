# SIDOC deploy con imágenes GHCR

Este flujo evita construir frontend/backend en el VPS. GitHub Actions publica:

- `ghcr.io/leonardorey-coder/sidoc-backend:<sha>`
- `ghcr.io/leonardorey-coder/sidoc-migrator:<sha>`
- `ghcr.io/leonardorey-coder/sidoc-frontend:<sha>`
- `ghcr.io/leonardorey-coder/sidoc-backend:latest`
- `ghcr.io/leonardorey-coder/sidoc-migrator:latest`
- `ghcr.io/leonardorey-coder/sidoc-frontend:latest`

## Primer setup del VPS

```bash
mkdir -p /home/sidoc/infra /home/sidoc/scripts
```

Copiar al VPS:

```text
/home/sidoc/infra/docker-compose.prod.yml
/home/sidoc/scripts/deploy.sh
```

Login único a GHCR:

```bash
echo "GITHUB_TOKEN_O_PAT" | docker login ghcr.io -u leonardorey-coder --password-stdin
```

## Deploy

```bash
SIDOC_IMAGE_TAG=latest \
R2_ACCOUNT_ID="..." \
R2_ACCESS_KEY_ID="..." \
R2_SECRET_ACCESS_KEY="..." \
R2_BUCKET_NAME="sidoc" \
bash /home/sidoc/scripts/deploy.sh
```

El frontend se compila dentro de GitHub Actions. Si se necesita `VITE_LIVEBLOCKS_PUBLIC_KEY`, configurarlo como secret del repositorio con ese mismo nombre antes de publicar imágenes.

Para deploy reproducible o rollback, usar el SHA corto publicado por GitHub Actions:

```bash
SIDOC_IMAGE_TAG=fab47f9 bash /home/sidoc/scripts/deploy.sh
```

## Flujo interno

El script:

1. Preserva/genera `/home/sidoc/.env.prod`.
2. Ejecuta `docker compose pull`.
3. Levanta `db` y `meilisearch`.
4. Corre `prisma migrate deploy` desde la imagen migrator.
5. Ejecuta `docker compose up -d --remove-orphans`.
6. Limpia imágenes huérfanas con `docker image prune -f`.

El VPS ya no necesita:

- `node_modules`
- `backend/node_modules`
- `backend/dist`
- `dist`
- build cache de Docker
- Bun para desplegar

La imagen backend runtime no incluye el CLI de Prisma; las migraciones usan una imagen separada para mantener tooling de build fuera del contenedor API.

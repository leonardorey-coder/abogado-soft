# SIDOC deploy con imágenes GHCR

Este flujo evita construir frontend/backend en el VPS. GitHub Actions publica:

- `ghcr.io/leonardorey-coder/sidoc-backend:<sha>`
- `ghcr.io/leonardorey-coder/sidoc-frontend:<sha>`
- `ghcr.io/leonardorey-coder/sidoc-backend:latest`
- `ghcr.io/leonardorey-coder/sidoc-frontend:latest`

## Primer setup del VPS

```bash
sudo mkdir -p /opt/sidoc/infra /opt/sidoc/scripts /opt/sidoc/secrets
sudo chown -R "$USER:$USER" /opt/sidoc
```

Copiar al VPS:

```text
/opt/sidoc/infra/docker-compose.prod.yml
/opt/sidoc/scripts/deploy.sh
```

Si se usa Google Drive:

```bash
scp google-service-account.json usuario@IP:/opt/sidoc/secrets/google-service-account.json
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
bash /opt/sidoc/scripts/deploy.sh
```

El frontend se compila dentro de GitHub Actions. Si se necesita `VITE_LIVEBLOCKS_PUBLIC_KEY`, configurarlo como secret del repositorio con ese mismo nombre antes de publicar imágenes.

Para deploy reproducible o rollback, usar el SHA corto publicado por GitHub Actions:

```bash
SIDOC_IMAGE_TAG=fab47f9 bash /opt/sidoc/scripts/deploy.sh
```

## Flujo interno

El script:

1. Preserva/genera `/opt/sidoc/.env.prod`.
2. Ejecuta `docker compose pull`.
3. Levanta `db` y `meilisearch`.
4. Corre `prisma migrate deploy` desde la imagen backend.
5. Ejecuta `docker compose up -d --remove-orphans`.
6. Limpia imágenes huérfanas con `docker image prune -f`.

El VPS ya no necesita:

- `node_modules`
- `backend/node_modules`
- `backend/dist`
- `dist`
- build cache de Docker
- Bun para desplegar

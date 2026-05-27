# infra/ — Infraestructura de producción

Contiene toda la configuración para desplegar AbogadoSoft en un servidor Ubuntu 24 LTS.

## Estructura

```
infra/
  db/                       Dumps de la BD actual (extraídos de Supabase Cloud)
  supabase/                 Stack Supabase self-hosted (~15 contenedores)
  nginx/                    Reverse proxy (frontend + proxy /api)
  docker-compose.prod.yml   App stack: backend + nginx + meilisearch
```

---

## Guía de instalación completa (primera vez)

### Paso 0 — Requisitos previos en el servidor

Servidor Ubuntu 24 LTS limpio con acceso SSH y usuario con `sudo`.
El script `deploy.sh --install` instala Docker, Bun y Node automáticamente.

---

### Paso 1 — Clonar el repo

```bash
git clone <URL_DEL_REPO> /opt/sidoc
cd /opt/sidoc
```

---

### Paso 2 — Generar JWT keys para Supabase

Necesarias antes de configurar los `.env`. Ejecutar en cualquier máquina:

```bash
# JWT_SECRET (mínimo 40 caracteres)
openssl rand -base64 40
# Ejemplo: dGhpcyBpcyBhIHZlcnkgc2VjcmV0IGtleQ==...

# ANON_KEY y SERVICE_ROLE_KEY — usar el generador oficial:
# https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
#
# Payload ANON_KEY:
#   { "role": "anon", "iss": "supabase", "iat": <epoch_now>, "exp": <epoch_+10años> }
# Payload SERVICE_ROLE_KEY:
#   { "role": "service_role", "iss": "supabase", "iat": <epoch_now>, "exp": <epoch_+10años> }
# Firmar ambos con el mismo JWT_SECRET usando HS256.
```

---

### Paso 3 — Crear archivo `.env.prod`

```bash
cp .env.prod.example .env.prod
nano .env.prod   # o vim / cualquier editor
```

Valores obligatorios a completar:


| Variable                    | Valor                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`         | Password fuerte para Postgres                                                     |
| `JWT_SECRET`                | Generado en Paso 2                                                                |
| `SUPABASE_ANON_KEY`         | Generado en Paso 2                                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Generado en Paso 2                                                                |
| `SUPABASE_JWT_SECRET`       | Mismo que `JWT_SECRET`                                                            |
| `SUPABASE_URL`              | `http://IP_SERVIDOR:8000`                                                         |
| `DATABASE_URL`              | `postgresql://postgres:POSTGRES_PASSWORD@supabase_db:5432/postgres?schema=public` |
| `DIRECT_URL`                | Igual que `DATABASE_URL` pero sin `pgbouncer=true`                                |
| `VITE_SUPABASE_URL`         | `http://IP_SERVIDOR:8000`                                                         |
| `VITE_API_URL`              | `http://IP_SERVIDOR/api`                                                          |
| `MEILISEARCH_KEY`           | Password fuerte para Meilisearch                                                  |
| `CORS_ORIGIN`               | `http://IP_SERVIDOR`                                                              |


---

### Paso 4 — Crear archivo `infra/supabase/.env`

```bash
cp infra/supabase/.env.example infra/supabase/.env
nano infra/supabase/.env
```

Copiar los mismos valores de `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` y `POSTGRES_PASSWORD` del paso anterior. Además:


| Variable             | Valor                                 |
| -------------------- | ------------------------------------- |
| `SITE_URL`           | `http://IP_SERVIDOR:3000` (o dominio) |
| `API_EXTERNAL_URL`   | `http://IP_SERVIDOR:8000`             |
| `DASHBOARD_PASSWORD` | Password para Supabase Studio         |


---

### Paso 5 — Google Service Account (solo si se usa Google Drive)

Subir el archivo JSON de la Service Account al servidor:

```bash
# Desde tu máquina local
scp abogadosoft-service-account.json usuario@IP_SERVIDOR:/opt/sidoc/backend/

# Verificar que está en la ruta correcta
ls /opt/sidoc/backend/abogadosoft-service-account.json
```

Si no se usa Google Drive, dejar `GOOGLE_SERVICE_ACCOUNT_PATH` vacío en `.env.prod`.

---

### Paso 5b — Cloudflare R2 (almacenamiento de documentos)

El backend sube y sirve archivos vía **S3-compatible API** de Cloudflare R2 (`backend/src/lib/storage/R2StorageProvider.ts`). No requiere contenedor extra: el contenedor `backend` usa las credenciales desde `.env.prod`.

En `.env.prod` (mismas variables que en [`.env.prod.example`](../.env.prod.example)):

| Variable | Descripción |
|---|---|
| `STORAGE_PROVIDER` | `r2` (por defecto en código) o `local` para solo disco en el servidor |
| `R2_ACCOUNT_ID` | Account ID de Cloudflare |
| `R2_ACCESS_KEY_ID` | Access Key del API Token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret del API Token |
| `R2_BUCKET_NAME` | Nombre del bucket |
| `R2_PUBLIC_URL` | Opcional: URL pública del bucket (dominio r2.dev o custom) para enlaces públicos |

Crear el token en Cloudflare Dashboard → R2 → Manage R2 API Tokens (permisos de lectura/escritura al bucket).

Migración histórica Drive/disco → R2 (opcional, servidor con Bun):

```bash
docker exec abogadosoft_backend bun src/scripts/migrateToR2.ts --dry-run
```

---

### Paso 6 — Actualizar Google OAuth callback

En [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → tu OAuth 2.0 Client:

- Añadir en **Authorized redirect URIs**:
  ```
  http://IP_SERVIDOR:8000/auth/v1/callback
  ```
  (o `https://` si ya tienes TLS)
- Si el dominio cambia en el futuro, actualizar esta URI aquí.

---

### Paso 7 — Firewall y puertos

```bash
# UFW en Ubuntu 24
sudo ufw allow 22/tcp     # SSH — no cerrar nunca primero
sudo ufw allow 80/tcp     # HTTP (frontend + API)
sudo ufw allow 443/tcp    # HTTPS (cuando haya TLS)
sudo ufw allow 8000/tcp   # Supabase API Gateway (Auth, Realtime)
sudo ufw enable

# Puertos SOLO red interna (no abrir al exterior):
# 5432  — Postgres
# 4001  — Backend (detrás de Nginx)
# 7700  — Meilisearch (solo red Docker, sin mapeo de puerto)
# 3001  — Supabase Studio (opcional, abrir solo si se necesita acceso externo)
```

---

### Paso 8 — TLS con certificado de la universidad

Si la uni provee certificado:

```bash
# Copiar cert y key al servidor
sudo mkdir -p /etc/ssl/abogadosoft
sudo cp fullchain.pem /etc/ssl/abogadosoft/
sudo cp privkey.pem   /etc/ssl/abogadosoft/

# Descomentar bloque HTTPS en infra/nginx/nginx.conf
# Actualizar rutas ssl_certificate y ssl_certificate_key
# Remontar el volumen en docker-compose.prod.yml:
#   - /etc/ssl/abogadosoft:/etc/ssl/abogadosoft:ro
```

Si se usa Let's Encrypt (dominio público):

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d TU_DOMINIO
# Los certs quedan en /etc/letsencrypt/live/TU_DOMINIO/
# Descomentar volumen letsencrypt en docker-compose.prod.yml
```

---

### Paso 9 — Ejecutar deploy

```bash
bash scripts/deploy.sh --install
```

El script hace automáticamente:

1. Instala Docker, Bun, Node.js
2. Levanta stack Supabase self-hosted (Postgres, Auth, Realtime, Kong, Studio)
3. Espera a que Postgres esté listo
4. Restaura BD en orden: `auth` → `storage` → `public`
5. Corre `prisma migrate deploy`
6. Build del frontend Vite
7. Levanta backend + Nginx + Meilisearch
8. Healthcheck de todos los servicios

---

### Paso 10 — Reindexar Meilisearch (post-install)

El índice de búsqueda queda vacío tras el restore. Reindexar una vez:

```bash
docker exec abogadosoft_backend bun src/scripts/reindex.ts
```

> Si prefieres no usar Meilisearch, ver sección "Deshabilitar Meilisearch" más abajo.

---

### Verificación final

```bash
bash scripts/deploy.sh --status

# Checklist manual:
curl http://IP_SERVIDOR/api/health          # backend vivo
curl http://IP_SERVIDOR                     # frontend carga
curl http://IP_SERVIDOR:8000/health         # Supabase Kong vivo
# Supabase Studio: http://IP_SERVIDOR:3001
# Login Google: probar desde el frontend
```

---

## Actualizaciones posteriores

```bash
# En el servidor
cd /opt/sidoc
bash scripts/deploy.sh --update
```

Hace: `git pull` → migraciones → rebuild frontend → restart contenedores.

## Comandos útiles

```bash
# Ver estado de todos los contenedores
bash scripts/deploy.sh --status

# Solo correr migraciones
bash scripts/deploy.sh --migrate

# Logs del backend
docker logs abogadosoft_backend -f

# Logs de Postgres
docker logs supabase_db -f

# Acceder a Postgres directamente
docker exec -it supabase_db psql -U postgres

# Reiniciar solo Supabase
cd infra/supabase && docker compose restart

# Reiniciar solo app
cd infra && docker compose -f docker-compose.prod.yml restart
```

## Cloudflare R2

Resumen: los binarios de documentos no van a Supabase Storage; van a **R2** mediante el cliente S3 del backend. El despliegue self-hosted **no cambia** ese flujo: basta con definir las variables `R2_*` y `STORAGE_PROVIDER=r2` en `.env.prod` (detalle en **Paso 5b** arriba).

- Código: `backend/src/lib/storage/StorageFactory.ts` (default `r2`), `R2StorageProvider.ts`.
- Alternativa sin R2: `STORAGE_PROVIDER=local` + `STORAGE_PATH` (solo disco del contenedor; ver volumen `backend_storage` en `docker-compose.prod.yml`).

## Meilisearch — búsqueda avanzada

Incluido en `docker-compose.prod.yml` como servicio **interno** — sin puerto expuesto al host. Solo el backend lo alcanza dentro de la red Docker (`http://meilisearch:7700`).

### Primer arranque — reindexar

Después de `--install`, la BD está restaurada pero el índice Meilisearch está vacío. Reindexar:

```bash
# Dentro del servidor, una sola vez
docker exec abogadosoft_backend \
  bun scripts/reindex.ts
```

O desde fuera del contenedor si Bun está instalado en el servidor:

```bash
cd /opt/sidoc/backend
DATABASE_URL=$(grep DIRECT_URL ../.env.prod | cut -d= -f2- | tr -d '"') \
MEILISEARCH_HOST=http://localhost:7700 \
MEILISEARCH_KEY=$(grep MEILISEARCH_KEY ../.env.prod | cut -d= -f2- | tr -d '"') \
bun src/scripts/reindex.ts
```

### Verificar desde el servidor (no expuesto a red externa)

```bash
# Solo funciona desde el host del servidor o dentro de un contenedor en app_network
curl http://localhost:7700/health          # NO funciona — puerto no expuesto
docker exec abogadosoft_meilisearch \
  wget -qO- http://localhost:7700/health   # SÍ funciona
```

### Deshabilitar Meilisearch (usar buscador interno Prisma)

El sistema tiene fallback completo a PostgreSQL sin cambios de código.

**1.** En `.env.prod`, cambiar:

```env
SEARCH_ENGINE=prisma
# MEILISEARCH_HOST=...   ← comentar o eliminar
# MEILISEARCH_KEY=...    ← comentar o eliminar
```

**2.** En `infra/docker-compose.prod.yml`, comentar el servicio `meilisearch` y el `depends_on` en `backend`.

**3.** Aplicar:

```bash
docker compose -f infra/docker-compose.prod.yml up -d
```

`SearchServiceFactory` resuelve el motor en arranque — sin recompilación.

> Prisma search es más lento en volúmenes grandes (>10k docs) pero no requiere infraestructura extra.

## URLs en producción


| Servicio             | URL                                          |
| -------------------- | -------------------------------------------- |
| App (frontend)       | `http://SERVIDOR_IP`                         |
| API Backend          | `http://SERVIDOR_IP/api`                     |
| Supabase Studio      | `http://SERVIDOR_IP:3001`                    |
| Supabase API Gateway | `http://SERVIDOR_IP:8000`                    |
| Meilisearch          | solo red interna Docker — sin acceso externo |


## Generar JWT keys para Supabase self-hosted

```bash
# JWT_SECRET
openssl rand -base64 40

# ANON_KEY y SERVICE_ROLE_KEY
# Ver: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Payload anon:
# { "role": "anon", "iss": "supabase", "iat": <now>, "exp": <now+10years> }
# Payload service_role:
# { "role": "service_role", "iss": "supabase", "iat": <now>, "exp": <now+10years> }
```


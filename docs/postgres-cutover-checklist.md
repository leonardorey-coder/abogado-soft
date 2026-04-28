# PostgreSQL Cutover Checklist

## Pre-cutover

1. Verificar que el contenedor `db` esté healthy.
2. Confirmar extensiones instaladas:
   - `pgcrypto`
   - `uuid-ossp`
   - `pg_trgm`
3. Regenerar si hace falta:
   - `python3 scripts/build_postgres_baseline.py`
   - `python3 scripts/build_postgres_data_import.py`
4. Validar que `DATABASE_URL` y `DIRECT_URL` apuntan al destino correcto.
5. Restaurar baseline y datos iniciales.
6. Ejecutar Prisma generate.
7. Validar que el backend arranca contra la nueva DB.

## Smoke tests obligatorios

1. `POST /api/auth/login`
2. `POST /api/auth/refresh`
3. `GET /api/auth/me`
4. `GET /api/documents`
5. `POST /api/documents/upload`
6. `GET /api/groups`
7. `GET /api/convenios`
8. `GET /api/cases`
9. `POST /api/backups`
10. `GET /api/search`

## Rollback

1. Mantener la base origen intacta hasta terminar validación.
2. Si falla cualquier smoke test crítico:
   - restaurar `DATABASE_URL`
   - restaurar `DIRECT_URL`
   - reiniciar backend
3. Confirmar `login`, `me` y `documents` antes de reabrir tráfico.

## Post-cutover

1. Reindexar Meilisearch si aplica.
2. Ejecutar backup manual contra la nueva DB.
3. Verificar cron de respaldos.
4. Validar métricas, logs y uso real durante las primeras horas.

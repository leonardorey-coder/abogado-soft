# PostgreSQL Self-Hosted

Este directorio contiene la base técnica para correr PostgreSQL propio dentro del stack de infraestructura.

## Componentes

- `init/00-extensions.sql`
  - habilita las extensiones requeridas por el schema actual:
    - `pgcrypto`
    - `uuid-ossp`
    - `pg_trgm`
- `baseline.sql`
  - baseline SQL limpio para PostgreSQL self-hosted
  - generado a partir de `infra/db/schema.sql`
  - remueve metacomandos de `pg_dump` y policies/RLS ligadas a Supabase
- `data_import.sql`
  - import de datos de `public`
  - generado a partir de `infra/db/full_dump.sql`
  - contiene solo `INSERT INTO public.*`

## Uso esperado

En producción, el servicio `db` vive dentro de [infra/docker-compose.prod.yml](../docker-compose.prod.yml) y expone el hostname interno `db`.

Las variables de entorno relevantes son:

- `DATABASE_URL`
- `DIRECT_URL`
- `POSTGRES_PASSWORD`

## Convención de conexión

- `DATABASE_URL`
  - conexión usada por el runtime del backend
- `DIRECT_URL`
  - conexión usada por Prisma CLI y tareas de mantenimiento
- si `DIRECT_URL` no existe, las tareas de migración y backup caen a `DATABASE_URL`

## Nota

La migración de datos desde Supabase Postgres a este Postgres self-hosted debe hacerse con un cutover controlado. La infraestructura aquí preparada no mueve datos por sí sola.

## Regenerar baseline

Si cambia el schema real de referencia, puedes regenerar el baseline con:

```bash
python3 scripts/build_postgres_baseline.py
python3 scripts/build_postgres_data_import.py
```

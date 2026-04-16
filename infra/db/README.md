# infra/db — Dumps de la BD

Extraídos desde Supabase Cloud (`wtduflglaygwfhttbbyk`) el 2026-04-15.
Cubre schemas `public`, `auth` y `storage`.

## Archivos


| Archivo            | Schema  | Contenido                                                            | Git        |
| ------------------ | ------- | -------------------------------------------------------------------- | ---------- |
| `schema.sql`       | public  | DDL puro (tablas, índices, ENUMs, extensiones)                       | versionado |
| `data.sql`         | public  | Solo INSERTs de datos reales                                         | ignorado   |
| `full_dump.sql`    | public  | Schema + datos public                                                | ignorado   |
| `auth_dump.sql`    | auth    | Schema + datos auth (usuarios, identidades Google, sessions, tokens) | ignorado   |
| `storage_dump.sql` | storage | Schema + migraciones (sin objetos)                                   | ignorado   |


`**auth_dump.sql` contiene:**

- `auth.users` — 5 usuarios
- `auth.identities` — 5 identidades (Google OAuth)
- `auth.sessions` — 2 sesiones activas
- `auth.refresh_tokens` — 44 tokens
- `auth.schema_migrations` — historial de migraciones GoTrue

## Orden de restore 1:1 en servidor

Respetar orden para FK correctas (`public.users` → `auth.users`):

```bash
PGCONN="postgresql://postgres:PASSWORD@localhost:5432/postgres"

# 1. Auth (GoTrue schema — usuarios e identidades)
psql "$PGCONN" -f infra/db/auth_dump.sql

# 2. Storage schema (migraciones)
psql "$PGCONN" -f infra/db/storage_dump.sql

# 3. Public schema (datos de negocio — referencia auth.users)
psql "$PGCONN" --single-transaction -f infra/db/full_dump.sql
```

> El `scripts/deploy.sh --install` ejecuta este restore automáticamente.

## Migraciones futuras

No usar estos dumps para migraciones incrementales.
Flujo: `supabase migration new` → SQL en `supabase/migrations/` → `prisma migrate deploy` en servidor.
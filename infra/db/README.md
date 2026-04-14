# infra/db — Dumps de la BD

Extraídos desde Supabase Cloud (`wtduflglaygwfhttbbyk`) el 2026-04-14.
Solo schema `public`. Sin owner, sin privileges.

## Archivos


| Archivo         | Contenido                                      | Uso                              |
| --------------- | ---------------------------------------------- | -------------------------------- |
| `schema.sql`    | DDL puro (tablas, índices, ENUMs, extensiones) | Inspección / comparar con Prisma |
| `data.sql`      | INSERTs de datos reales (sin DDL)              | Referencia de datos de poblacion |
| `full_dump.sql` | Schema + datos juntos                          | **Restore completo** — usar este |


## Restore en Supabase self-hosted (servidor)

```bash
# 1. Supabase stack corriendo en el servidor
# 2. Restore completo contra Postgres self-hosted
psql "postgresql://postgres:PASSWORD@localhost:5432/postgres" \
  --single-transaction \
  -f infra/db/full_dump.sql
```

> Los comentarios de FK circular en `document_comments` / `convenio_comments`
> desaparecen usando `full_dump.sql` en lugar de `data.sql` suelto,
> porque el full dump incluye `SET CONSTRAINTS ALL DEFERRED` implícito por orden de tablas.

## Migraciones futuras

No usar estos dumps para migraciones incrementales.
Usar flujo Supabase CLI → `supabase migration new` → `supabase db push`.
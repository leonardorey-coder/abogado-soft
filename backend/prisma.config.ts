import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun prisma/seed.ts',
  },
  datasource: {
    // Usa DIRECT_URL si existe; si no, cae a DATABASE_URL (Postgres local o remoto).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});


import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const backendRoot = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(backendRoot, '.env') });
loadEnv({ path: resolve(backendRoot, '.env.local'), override: true });

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


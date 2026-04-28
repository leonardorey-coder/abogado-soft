import { defineConfig } from 'prisma/config';
import { getDatabaseUrls } from './src/lib/env.js';

const { migrationUrl } = getDatabaseUrls();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});


# ==============================================================================
# backend/Dockerfile — AbogadoSoft Backend (Express + Bun)
# Multi-stage: deps/build → production deps → runner
# ==============================================================================

# Usar etiqueta cercana al Bun del lockfile/ci evita fallos por cambios menores en :1.
FROM oven/bun:1.3.13-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
ENV NODE_ENV=development
COPY package.json bun.lock* ./
# Prisma se genera en el stage build; el install ignora scripts para ser determinista.
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN bun install --frozen-lockfile --ignore-scripts

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN bun run build

# ─── Dependencias de producción ───────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json bun.lock* ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN bun install --frozen-lockfile --production --ignore-scripts \
  && bun pm cache rm

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV PORT=4001 \
    TMPDIR=/tmp \
    PUPPETEER_CACHE_DIR=/tmp/puppeteer

RUN addgroup -S app \
  && adduser -S app -G app \
  && chown app:app /app

COPY --from=prod-deps --chown=app:app /app/package.json ./package.json
COPY --from=prod-deps --chown=app:app /app/bun.lock ./bun.lock
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app prisma ./prisma
COPY --chown=app:app prisma.config.ts ./prisma.config.ts

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4001/api/health || exit 1

USER app

CMD ["bun", "dist/server.js"]

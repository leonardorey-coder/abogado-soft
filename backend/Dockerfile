# ==============================================================================
# backend/Dockerfile — AbogadoSoft Backend (Express + Bun)
# Multi-stage: deps → build → runner
# ==============================================================================

# Usar etiqueta cercana al Bun del lockfile/ci (evita fallos en --frozen-lockfile por cambio menor de semver en :1).
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
# postinstall ejecuta prisma generate; hace falta el esquema antes de install
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN bun install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Genera el cliente Prisma para Alpine/Linux
RUN bunx prisma generate

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/bun.lock ./bun.lock
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4001/api/health || exit 1

CMD ["bun", "src/server.ts"]

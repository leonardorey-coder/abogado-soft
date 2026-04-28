# ==============================================================================
# backend/Dockerfile — AbogadoSoft Backend (Express + Bun)
# Multi-stage: deps → build → runner
# ==============================================================================

FROM oven/bun:1-alpine AS deps
WORKDIR /app
ARG USE_HOST_NODE_MODULES=0
ENV TMPDIR=/tmp \
    BUN_INSTALL_CACHE_DIR=/tmp/bun-install-cache
COPY package.json bun.lock* ./
RUN if [ "$USE_HOST_NODE_MODULES" != "1" ]; then bun install --frozen-lockfile --backend=copyfile; fi

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
ARG USE_HOST_NODE_MODULES=0
COPY . .
RUN if [ "$USE_HOST_NODE_MODULES" = "1" ] && [ ! -d node_modules ]; then echo "node_modules no existe en el contexto para USE_HOST_NODE_MODULES=1" && exit 1; fi
# Genera el cliente Prisma para Alpine/Linux
RUN bunx prisma generate
# Compila el servidor a bundle único
RUN bun build src/server.ts --outdir dist --target bun --minify

# ─── Runner ───────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Solo lo necesario en runtime
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4001/api/health || exit 1

CMD ["bun", "dist/server.js"]

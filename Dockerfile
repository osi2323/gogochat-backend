# -----------------------------------------------------------------------------
# Base
FROM node:20-alpine AS base
WORKDIR /usr/src/app
RUN npm install -g pnpm

# -----------------------------------------------------------------------------
# Dependencies (dev + prod)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Development stage
FROM deps AS dev
COPY . .
CMD ["pnpm", "run", "start:dev"]

# -----------------------------------------------------------------------------
# Build stage
FROM deps AS builder
COPY . .
RUN pnpm build

# -----------------------------------------------------------------------------
# Production runtime
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /usr/src/app

# pnpm + pm2 runtime
RUN npm install -g pnpm pm2

COPY package.json pnpm-lock.yaml ./

# node_modules + dist
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# sadece production paketleri bırak
RUN pnpm prune --prod && pnpm store prune

# non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Healthcheck daha toleranslı
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4050/health || exit 1

EXPOSE 4000

# Socket.IO olayları şu an process-local çalışıyor.
# Redis/cluster adapter olmadığı için çoklu PM2 instance join-effect gibi
# realtime yayınları process sınırında bırakıyor. Varsayılanı tek instance
# tutuyoruz; yatay ölçekleme gerekiyorsa önce adapter eklenmeli.
CMD ["pm2-runtime", "dist/main.js", "-i", "1"]

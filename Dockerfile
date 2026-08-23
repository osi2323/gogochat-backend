# -----------------------------------------------------------------------------
# Base
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# -----------------------------------------------------------------------------
# Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Build
FROM deps AS builder
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Production
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /usr/src/app

RUN npm install -g pm2

COPY package.json package-lock.json ./

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

RUN npm prune --omit=dev

# Upload / backup klasörlerini appuser'a yazılabilir hazırla
RUN mkdir -p /usr/src/app/uploads/backups/master \
    && addgroup -S appgroup \
    && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/src/app/uploads

USER appuser

EXPOSE 4000

CMD ["pm2-runtime", "dist/main.js", "-i", "1"]

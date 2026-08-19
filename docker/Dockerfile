# syntax=docker/dockerfile:1.4

# ─── Stage 1: Dependencies ────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile 2>/dev/null || npm install

# ─── Stage 2: Builder ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Git info passed from docker-compose build args
ARG GIT_BRANCH=unknown
ARG GIT_COMMIT=unknown
ARG BUILD_DATE
ENV GIT_BRANCH=${GIT_BRANCH} \
    GIT_COMMIT=${GIT_COMMIT} \
    BUILD_DATE=${BUILD_DATE}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript (prebuild gera o version.json)
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ─── Stage 3: Runner ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy necessary files
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/version.json ./version.json

# Create keys directory
RUN mkdir -p keys && chown nodejs:nodejs keys

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health/authentication_api || exit 1

CMD ["node", "dist/server.js"]

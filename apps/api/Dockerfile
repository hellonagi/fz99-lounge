# Multi-stage Dockerfile for NestJS v11 (npm workspaces monorepo)
# Build context: repository root (-f apps/api/Dockerfile .)
# Best practices: non-root user, cache mounts, health checks

ARG NODE_VERSION=20-alpine

# =====================================
# Base stage - shared dependencies
# =====================================
FROM public.ecr.aws/docker/library/node:${NODE_VERSION} AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# =====================================
# Dependencies stage - install all deps
# =====================================
FROM base AS dependencies

# Copy all workspace manifests (npm ci validates the lockfile against them)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install api + shared dependencies only, with cache mount.
# npm may nest api deps under apps/api/node_modules; ensure the dir exists
# so later COPY --from never fails.
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w api -w @fz99/shared --include-workspace-root && \
    mkdir -p apps/api/node_modules

# Generate Prisma client (prisma CLI may be nested, so resolve via workspace)
COPY apps/api/prisma ./apps/api/prisma/
RUN npm exec -w api -- prisma generate

# =====================================
# Build stage - compile TypeScript
# =====================================
FROM dependencies AS build

# Copy shared package and API sources
COPY packages/shared ./packages/shared
COPY apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src

# Build shared package first, then the API
RUN npm run build -w @fz99/shared && npm run build -w api

# =====================================
# Production dependencies stage
# =====================================
FROM base AS production-deps

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install only production dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w api -w @fz99/shared --include-workspace-root --omit=dev && \
    mkdir -p apps/api/node_modules

COPY apps/api/prisma ./apps/api/prisma/
RUN npm exec -w api -- prisma generate

# =====================================
# Development stage
# =====================================
FROM base AS development

# Install development tools
RUN apk add --no-cache curl

USER nestjs

# Copy workspace manifests and sources
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs packages ./packages
COPY --chown=nestjs:nodejs apps/api ./apps/api

# Copy dependencies (root + nested)
COPY --chown=nestjs:nodejs --from=dependencies /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules

# Build shared so the API can resolve @fz99/shared at runtime
RUN npm run build -w @fz99/shared

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev", "-w", "api"]

# =====================================
# Production stage
# =====================================
FROM base AS production

# Set Node environment
ENV NODE_ENV=production

USER nestjs

# Copy production dependencies (root + nested)
COPY --chown=nestjs:nodejs --from=production-deps /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=production-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=nestjs:nodejs --from=production-deps /app/apps/api/prisma ./apps/api/prisma

# Copy built shared package (node_modules/@fz99/shared symlinks to packages/shared)
COPY --chown=nestjs:nodejs --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=nestjs:nodejs --from=build /app/packages/shared/dist ./packages/shared/dist

# Copy built application
COPY --chown=nestjs:nodejs --from=build /app/apps/api/dist ./apps/api/dist
COPY --chown=nestjs:nodejs package.json package-lock.json ./
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npm exec -w api -- prisma migrate deploy && node apps/api/dist/src/main"]

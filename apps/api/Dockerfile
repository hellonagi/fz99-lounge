# Multi-stage Dockerfile for NestJS v11 (2025年9月版)
# Best practices: non-root user, cache mounts, health checks

ARG NODE_VERSION=20-alpine

# =====================================
# Base stage - shared dependencies
# =====================================
FROM node:${NODE_VERSION} AS base

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

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# Generate Prisma client
RUN npx prisma generate

# =====================================
# Build stage - compile TypeScript
# =====================================
FROM dependencies AS build

# Copy config files needed for build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# =====================================
# Production dependencies stage
# =====================================
FROM base AS production-deps

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && \
    npx prisma generate

# =====================================
# Development stage
# =====================================
FROM base AS development

# Install development tools
RUN apk add --no-cache curl

USER nestjs

# Copy dependencies
COPY --chown=nestjs:nodejs --from=dependencies /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs prisma ./prisma/

# Copy source code
COPY --chown=nestjs:nodejs . .

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]

# =====================================
# Production stage
# =====================================
FROM base AS production

# Set Node environment
ENV NODE_ENV=production

USER nestjs

# Copy production dependencies
COPY --chown=nestjs:nodejs --from=production-deps /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=production-deps /app/prisma ./prisma

# Copy built application
COPY --chown=nestjs:nodejs --from=build /app/dist ./dist
COPY --chown=nestjs:nodejs package*.json ./

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
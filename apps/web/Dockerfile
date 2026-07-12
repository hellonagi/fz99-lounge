# syntax=docker/dockerfile:1
# Build context: repository root (-f apps/web/Dockerfile .)

ARG NODE_VERSION=20-alpine

FROM public.ecr.aws/docker/library/node:${NODE_VERSION} AS base
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app

FROM base AS dependencies
# Copy all workspace manifests (npm ci validates the lockfile against them)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,target=/root/.npm \
    npm ci -w web -w @fz99/shared --include-workspace-root && \
    mkdir -p apps/web/node_modules

FROM base AS development
RUN apk add --no-cache curl
COPY --chown=nextjs:nodejs package*.json ./
COPY --chown=nextjs:nodejs packages ./packages
COPY --chown=nextjs:nodejs apps/web ./apps/web
COPY --chown=nextjs:nodejs --from=dependencies /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
RUN npm run build -w @fz99/shared
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["dumb-init", "npm", "run", "dev", "-w", "web"]

FROM base AS build
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID}
COPY package*.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/web/node_modules ./apps/web/node_modules
RUN npm run build -w @fz99/shared && npm run build -w web

FROM base AS production
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["dumb-init", "node", "apps/web/server.js"]

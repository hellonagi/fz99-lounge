# syntax=docker/dockerfile:1

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app

FROM base AS dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS development
RUN apk add --no-cache curl
COPY --chown=nextjs:nodejs --from=dependencies /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package*.json ./
COPY --chown=nextjs:nodejs . .
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["dumb-init", "npm", "run", "dev"]

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS production
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["dumb-init", "node", "server.js"]

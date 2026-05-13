# syntax=docker/dockerfile:1

# Pin base image by digest for hermetic builds. Same context → same layer hashes
# across machines, so `pulumi up` doesn't see a fake "image changed" diff each run.
# Refresh periodically when accepting upstream Alpine/Node patches.
ARG NODE_BASE=node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e

# Build stage
FROM ${NODE_BASE} AS builder

# SOURCE_DATE_EPOCH is honored by reproducible tooling. Combined with buildkit's
# rewrite-timestamp output, this gives bit-identical image layers across rebuilds.
ARG SOURCE_DATE_EPOCH=1700000000
ENV SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH

WORKDIR /app

# Copy lockfiles + manifests first so dependency installs can layer-cache.
COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

# `npm ci` enforces lockfile (no implicit version resolution), making installs
# deterministic. We still need the client devDependencies for `npm run build`,
# so client install does not pass --omit=dev.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev && \
    cd client && npm ci

# Copy only backend, frontend, and scripts (avoid copying entire directory)
COPY server ./server
COPY client ./client
COPY scripts ./scripts

# Build the React frontend
RUN cd client && npm run build

# Production stage
FROM ${NODE_BASE}

ARG SOURCE_DATE_EPOCH=1700000000
ENV SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH

WORKDIR /app

# Copy lockfile + manifest
COPY package.json package-lock.json ./

# `npm ci --omit=dev` for deterministic production-only installs.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/client/build ./client/build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server/index.js"]

# syntax=docker/dockerfile:1
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for root and client
COPY package*.json ./
COPY client/package*.json ./client/

# Install ALL dependencies (including dev deps for build) with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install --production && \
    cd client && npm install --production

# Copy only backend, frontend, and scripts (avoid copying entire directory)
COPY server ./server
COPY client ./client
COPY scripts ./scripts

# Build the React frontend
RUN cd client && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install --production

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

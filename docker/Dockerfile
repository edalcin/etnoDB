# Multi-stage build for etnoDB application
# Target: <500MB image size (estimated: 120-180MB)

# ============================================
# Stage 1: Builder - Install dependencies and build assets
# ============================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY backend ./backend
COPY frontend ./frontend
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Build Tailwind CSS
RUN npm run build:css

# ============================================
# Stage 2: Production - Minimal runtime image
# ============================================
FROM node:20-alpine

# Build metadata
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL build.date="${BUILD_DATE}"
LABEL build.commit="${GIT_COMMIT}"
LABEL build.version="1.0.0-debug"

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy application code
COPY backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application ports
EXPOSE 3001 3002 3003

# Health check (checks all three ports)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/ || \
      curl -f http://localhost:3002/ || \
      curl -f http://localhost:3003/ || exit 1

# Start application
CMD ["npm", "start"]

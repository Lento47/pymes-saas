FROM node:22-alpine

WORKDIR /app

# Install OpenSSL for Prisma + build tools for native addons (bcrypt)
RUN apk add --no-cache openssl libc6-compat python3 make g++ ffmpeg

# Install pnpm (pinned to match packageManager in package.json)
RUN corepack enable && corepack prepare pnpm@10.11.1 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

# Copy Prisma schema before install so the postinstall "prisma generate" can find it
COPY apps/api/prisma ./apps/api/prisma

# Install dependencies - use workspace install
RUN pnpm install --frozen-lockfile --recursive

# Copy source code (only what's not in .dockerignore)
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN pnpm --prefix apps/api build

# Expose port
EXPOSE 4000

# Health check endpoint for Railway

# Copy entrypoint script and make it executable
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

# Security: do not run as root
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

# Run migrations then start API
ENTRYPOINT ["/app/entrypoint.sh"]

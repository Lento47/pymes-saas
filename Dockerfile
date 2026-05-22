FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma + build tools for native addons (bcrypt)
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy ONLY the package.json files needed for dependency resolution
# (apps/web/package.json is excluded by .dockerignore)
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Copy Prisma schema before install so postinstall "prisma generate" can find it
COPY apps/api/prisma ./apps/api/prisma

# Install dependencies — ONLY api + shared-types (web is completely ignored)
RUN pnpm install --frozen-lockfile --filter ./apps/api

# Copy source code (apps/web/** excluded by .dockerignore)
COPY . .

# Generate Prisma client (with final schema after COPY . .)
RUN cd apps/api && npx prisma generate

# Build API
RUN pnpm --prefix apps/api build

# Expose port
EXPOSE 4000

# Copy entrypoint script
COPY entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh

# Run migrations then start API
ENTRYPOINT ["/app/entrypoint.sh"]

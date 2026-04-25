FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl libc6-compat

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

# Install dependencies - use workspace install
RUN pnpm install --frozen-lockfile --recursive

# Copy source code
COPY . .

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN pnpm --prefix apps/api build

# Expose port
EXPOSE 4000

# Run migrations then start API
CMD sh -c "cd apps/api && npx prisma migrate deploy && node dist/src/main"

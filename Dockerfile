FROM node:20-alpine

WORKDIR /app

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
RUN pnpm exec prisma generate

# Build API
RUN pnpm --prefix apps/api build

# Expose port
EXPOSE 4000

# Run API
CMD ["node", "apps/api/dist/main"]

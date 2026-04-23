FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build API
RUN cd apps/api && npm run build

# Expose port
EXPOSE 4000

# Run API
CMD ["node", "apps/api/dist/main"]

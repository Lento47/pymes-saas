import { defineConfig, env } from "prisma/config";

// On Railway, DATABASE_URL is set. Locally, fall back to a dummy URL.
// The actual connection at runtime uses pg Pool adapter (PrismaService.ts).
const databaseUrl = (() => {
  try {
    return env("DATABASE_URL");
  } catch {
    return "postgresql://user:password@localhost:5432/saas_db?schema=public";
  }
})();

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
});
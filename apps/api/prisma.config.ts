import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    connectionString: process.env.DATABASE_URL,
  },
});

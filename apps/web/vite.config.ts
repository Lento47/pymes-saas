import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Paddle sandbox — client-side token is public, safe for frontend
  define: {
    'import.meta.env.VITE_PADDLE_CLIENT_TOKEN': JSON.stringify(process.env.VITE_PADDLE_CLIENT_TOKEN || 'test_5e8c6bb9ac0caa99c0d4d7675f4'),
    'import.meta.env.VITE_PADDLE_ENVIRONMENT': JSON.stringify(process.env.VITE_PADDLE_ENVIRONMENT || 'sandbox'),
    'import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY': JSON.stringify(process.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || 'pri_01kq0w7bt8n3hdyayate39wrvx'),
    'import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL': JSON.stringify(process.env.VITE_PADDLE_PRICE_STARTER_ANNUAL || 'pri_01kq1c25yej2mxjvjn07fhv2fw'),
    'import.meta.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY': JSON.stringify(process.env.VITE_PADDLE_PRICE_GROWTH_MONTHLY || 'pri_01kq0we4j1wf2pgmh3w14arc6c'),
    'import.meta.env.VITE_PADDLE_PRICE_GROWTH_ANNUAL': JSON.stringify(process.env.VITE_PADDLE_PRICE_GROWTH_ANNUAL || 'pri_01kq1bqs2v3hkx3d0mx4wkxsvg'),
    'import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY': JSON.stringify(process.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || 'pri_01kq0wjzkyncpwaj33m1fppppj'),
    'import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL': JSON.stringify(process.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL || 'pri_01kq1bgffcm5jp82ytctx9necr'),
    'import.meta.env.VITE_PADDLE_PRICE_AI_ASSISTANT_MONTHLY': JSON.stringify(process.env.VITE_PADDLE_PRICE_AI_ASSISTANT_MONTHLY || ''),
    'import.meta.env.VITE_PADDLE_PRICE_AI_ASSISTANT_ANNUAL': JSON.stringify(process.env.VITE_PADDLE_PRICE_AI_ASSISTANT_ANNUAL || ''),
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "/",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "wouter"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover"],
          charts: ["recharts"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // Socket.io WebSocket — must be proxied separately from /api
      "/socket.io": {
        target: "http://localhost:4000",
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Vitest configuration
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
});

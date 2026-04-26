import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
});

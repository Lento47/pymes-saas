import path from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /**
   * Where `.env*` files are read from, which is NOT `root`.
   *
   * `root` is `client/` (below), and `envDir` defaults to `root` — so without this,
   * Vite looked for `.env.production` in `apps/web/client/`, where no env file has
   * ever existed, and every `import.meta.env.VITE_*` read resolved to `undefined` in
   * every build. The env files are one level up, in `apps/web/`.
   *
   * The one that hurt was `VITE_MARKETPLACE_API_URL`. A production build silently
   * fell back to the staging Worker, which refuses `https://pymeshub.lat` as an
   * origin (`wrangler.toml`, `CORS_ORIGINS`) and answers a refused origin with a
   * 403 carrying no `Access-Control-*` headers — so every marketplace call died as
   * a "CORS policy" error in the browser console and the 403 underneath it was
   * never once visible. This line is the fix; the plugin below is the guardrail.
   */
  envDir: import.meta.dirname,
  plugins: [
    react(),
    /**
     * A production build that cannot name the marketplace Worker fails here.
     *
     * The failure this prevents is a *silent* one: a missing variable used to
     * produce a working bundle that talked to the wrong environment, and the only
     * symptom arrived in a customer's browser as an error naming CORS. A build that
     * stops is a build somebody can fix.
     *
     * `config.env` carries what `envDir` loaded, so this reads the same value the
     * client bundle will. Only `build` + `production` is checked: `vite dev` has no
     * `.env.production` by design and points at `wrangler dev`, and `vitest` runs
     * with `command === "serve"`.
     */
    {
      name: "require-production-env",
      configResolved(resolved) {
        if (resolved.command !== "build" || resolved.mode !== "production") return;
        const missing = ["VITE_MARKETPLACE_API_URL"].filter(
          (key) => !resolved.env[key],
        );
        if (missing.length === 0) return;
        throw new Error(
          `Cannot build for production: ${missing.join(", ")} not set. ` +
            `Expected it in ${path.resolve(import.meta.dirname, ".env.production")} ` +
            `or the build environment. A production bundle must not guess an API host — ` +
            `guessing is what pointed production at the staging Worker.`,
        );
      },
    } satisfies Plugin,
  ],
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
      /**
       * `motion/react` → the `framer-motion` this app already ships.
       *
       * The Arc components in `client/src/components/arc` import from `motion/react`,
       * because the package `motion` was renamed to `framer-motion` after those components
       * were written. They are the same library at the same major: `framer-motion@12`
       * exports every symbol they use — `motion`, `AnimatePresence`, `animate`,
       * `useMotionValue`, `useTransform`, `useInView`, `useReducedMotion` — and this repo
       * already imports it in seven files, including `lib/motion/springs.ts`.
       *
       * So the alias avoids adding a second copy of one animation library for the sake of
       * an import specifier, and it means the Arc components animate on exactly the same
       * runtime as everything else in the app.
       */
      "motion/react": "framer-motion",
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
    include: ["src/**/*.{test,spec}.{ts,tsx}", "../cloudflare-worker.test.js"],
    css: false,
  },
});

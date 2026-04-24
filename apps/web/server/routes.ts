import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

/**
 * Proxy hacia Nest (prefijo global `/api`).
 *
 * - No usar `app.use("/api", proxy)`: Express quita el prefijo y `req.url` pasa a ser
 *   `/auth/login` en lugar de `/api/auth/login`, y el API no coincide.
 * - `pathFilter: "/api"` + `app.use(proxy)` mantiene `req.url` completo.
 * - `fixRequestBody`: `express.json()` ya leyó el body; hay que reinyectarlo en la petición al upstream.
 */
export async function registerRoutes(_httpServer: unknown, app: import("express").Express) {
  const defaultTarget = process.env.NODE_ENV === 'production' ? undefined : "http://127.0.0.1:4000";
  const target = process.env.API_PROXY_TARGET ?? defaultTarget;

  if (!target) {
    throw new Error('API_PROXY_TARGET environment variable must be set in production.');
  }

  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: "/api",
      on: {
        proxyReq: fixRequestBody,
      },
    }),
  );
}

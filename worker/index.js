export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── WebSocket proxying ──────────────────────────────────────────────────
    // Cloudflare Workers require explicit WebSocket pair handling; plain fetch()
    // does NOT propagate the 101 upgrade across origins reliably.
    if (url.pathname.startsWith("/socket.io/")) {
      const apiBase = env.API_URL || "https://api.pymeshub.lat";

      // Check if this is a WebSocket upgrade request
      const upgrade = request.headers.get("Upgrade");
      if (upgrade === "websocket") {
        const target = new URL(url.pathname + url.search, apiBase);
        // Strip origin → target so the request looks native to the backend
        const req = new Request(target.toString(), request);
        req.headers.set("Host", target.host);

        // Open backend WebSocket
        const backendResponse = await fetch(req);

        // If backend responds with 101, pair it with the client
        if (backendResponse.status === 101 && backendResponse.webSocket) {
          const [clientWs, serverWs] = Object.values(new WebSocketPair());
          // Accept the backend WebSocket
          serverWs.accept();
          // Connect client and backend bidirectionally
          const backendWs = backendResponse.webSocket;
          backendWs.accept();

          // Pipe client → backend
          clientWs.addEventListener("message", (e) => backendWs.send(e.data));
          clientWs.addEventListener("close", () => backendWs.close());
          clientWs.addEventListener("error", () => backendWs.close());

          // Pipe backend → client
          backendWs.addEventListener("message", (e) => clientWs.send(e.data));
          backendWs.addEventListener("close", () => clientWs.close());
          backendWs.addEventListener("error", () => clientWs.close());

          return new Response(null, {
            status: 101,
            webSocket: clientWs,
            headers: {
              "Upgrade": "websocket",
              "Connection": "Upgrade",
            },
          });
        }

        // If 101 failed, let socket.io fall back to polling
        return backendResponse;
      }

      // Regular HTTP polling: proxy normally
      const target = new URL(url.pathname + url.search, apiBase);
      const proxied = new Request(target.toString(), request);
      proxied.headers.set("Host", target.host);
      return fetch(proxied);
    }

    // ── API proxy with KV cache ────────────────────────────────────────────
    if (url.pathname.startsWith("/api/")) {
      const apiBase = env.API_URL || "https://api.pymeshub.lat";
      const target = new URL(url.pathname + url.search, apiBase);

      // Webhook verifications + POST requests bypass KV cache
      if (url.pathname.startsWith("/api/inbound/") || request.method !== "GET") {
        const proxied = new Request(target.toString(), request);
        proxied.headers.set("Host", target.host);
        return fetch(proxied);
      }

      // Cache GET requests with KV
      if (request.method === "GET" && env.KVhub) {
        const cacheKey = url.pathname + url.search;
        const cached = await env.KVhub.get(cacheKey, { type: "text" });
        if (cached) {
          return new Response(cached, {
            headers: {
              "Content-Type": "application/json",
              "X-Cache": "HIT",
              "Cache-Control": "public, max-age=60",
            },
          });
        }

        const proxied = new Request(target.toString(), request);
        proxied.headers.set("Host", target.host);
        const response = await fetch(proxied);

        if (response.ok) {
          const body = await response.text();
          await env.KVhub.put(cacheKey, body, { expirationTtl: 60 });
          return new Response(body, {
            status: response.status,
            headers: {
              "Content-Type": response.headers.get("Content-Type") || "application/json",
              "X-Cache": "MISS",
              "Cache-Control": "public, max-age=60",
            },
          });
        }

        return response;
      }

      // Non-cached or no KV — pass through
      const proxied = new Request(target.toString(), request);
      proxied.headers.set("Host", target.host);
      return fetch(proxied);
    }

    return env.ASSETS.fetch(request);
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // WebSocket passthrough for real-time updates
    if (url.pathname.startsWith("/socket.io/")) {
      const apiBase = env.API_URL || "https://api.pymeshub.lat";
      const target = new URL(url.pathname + url.search, apiBase);
      const proxied = new Request(target.toString(), request);
      proxied.headers.set("host", target.host);
      return fetch(proxied);
    }

    if (url.pathname.startsWith("/api/")) {
      const apiBase = env.API_URL || "https://api.pymeshub.lat";
      const target = new URL(url.pathname + url.search, apiBase);

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
        proxied.headers.set("host", target.host);
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
      proxied.headers.set("host", target.host);
      return fetch(proxied);
    }

    return env.ASSETS.fetch(request);
  },
};

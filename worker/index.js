export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const apiBase = env.API_URL || "https://api.pymeshub.lat";
      const target = new URL(url.pathname + url.search, apiBase);

      const proxied = new Request(target.toString(), request);
      proxied.headers.set("host", target.host);

      return fetch(proxied);
    }

    return env.ASSETS.fetch(request);
  },
};

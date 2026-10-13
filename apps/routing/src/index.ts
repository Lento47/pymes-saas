import { Container } from "@cloudflare/containers";

export class OsrmContainer extends Container {
	defaultPort = 5000;
	sleepAfter = "10m";
	enableInternet = false;
}

interface Env {
	OSRM: DurableObjectNamespace<OsrmContainer>;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (
			request.method !== "GET" ||
			!/^\/(route|table)\/v1\/driving\/[0-9.,;-]+$/.test(url.pathname) ||
			url.toString().length > 2_048
		) {
			return new Response("Unsupported routing request", { status: 400 });
		}
		return env.OSRM.getByName("costa-rica").fetch(request);
	},
};

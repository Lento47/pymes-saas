const checks = [
	{
		name: "web application",
		url: "https://pymeshub.lat/",
		expectType: "text/html",
	},
	{
		name: "API health",
		url: "https://api.pymeshub.lat/health",
		expectType: "application/json",
		validate: async (response) => {
			const health = await response.json();
			if (health.ok !== true || health.db !== "ok") {
				throw new Error(`unhealthy response: ${JSON.stringify(health)}`);
			}
		},
	},
	{
		name: "map style",
		url: "https://maps.pymeshub.lat/styles/pymeshub/style.json",
		expectType: "application/json",
		validate: async (response) => {
			const style = await response.json();
			if (style.version !== 8 || !style.sources) {
				throw new Error("response is not a MapLibre style document");
			}
		},
	},
	{
		name: "representative map tile",
		url: "https://tiles.openfreemap.org/natural_earth/ne2sr/0/0/0.png",
		expectType: "image/png",
		headers: { Range: "bytes=0-1023" },
		allowedStatuses: [206],
	},
];

const failures = [];

for (const check of checks) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20_000);
	try {
		const response = await fetch(check.url, {
			headers: check.headers,
			signal: controller.signal,
		});
		const statuses = check.allowedStatuses ?? [200];
		if (!statuses.includes(response.status)) {
			throw new Error(`unexpected HTTP ${response.status}`);
		}
		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.toLowerCase().includes(check.expectType)) {
			throw new Error(`unexpected content type ${contentType || "(missing)"}`);
		}
		if (check.validate) await check.validate(response);
		else await response.body?.cancel();
		console.log(`PASS ${check.name} (${response.status})`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		failures.push(`${check.name}: ${message}`);
		console.error(`FAIL ${check.name}: ${message}`);
	} finally {
		clearTimeout(timeout);
	}
}

if (failures.length > 0) {
	console.error(`Production uptime checks failed (${failures.length}/${checks.length}).`);
	process.exitCode = 1;
}

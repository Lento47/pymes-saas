import { expect, test } from "bun:test";

import { createContext } from "../src/context";
import { world } from "./harness";

test("request context applies the configured log threshold to routing metrics", async () => {
	const fixture = world();
	const originalLog = console.log;
	const lines: string[] = [];
	console.log = (value) => lines.push(String(value));
	try {
		fixture.env.LOG_LEVEL = "info";
		const context = await createContext({
			env: fixture.env,
			request: new Request("https://api.test/trpc/cart.quote"),
			requestId: "routing-log-test",
		});
		context.logger.info("routing.quote.ok", { providerLatencyMs: 12 });
		expect(lines).toHaveLength(1);
		expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
			level: "info",
			message: "routing.quote.ok",
			requestId: "routing-log-test",
			providerLatencyMs: 12,
		});
		expect(lines[0]).not.toContain("minLevel");
	} finally {
		console.log = originalLog;
		fixture.close();
	}
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const detail = readFileSync(
	join(import.meta.dir, "..", "app", "(delivery)", "delivery", "[id].tsx"),
	"utf8",
);

describe("courier delivery itinerary", () => {
	test("pickup and drop-off share one route card", () => {
		expect(detail).toContain("<RouteStops");
		expect(detail).toContain("export function RouteStops");
		expect(detail).toContain("delivery.stop.pickup");
		expect(detail).toContain("delivery.stop.dropoff");
		expect(detail).not.toContain("<StopCard");
		expect(detail).not.toContain('label={t("delivery.navigate")}');
	});
});

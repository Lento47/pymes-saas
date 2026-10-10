import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const board = readFileSync(
	join(import.meta.dir, "..", "app", "(delivery)", "delivery.tsx"),
	"utf8",
);

describe("courier board accept", () => {
	test("a refused accept refetches deliveries and opens a run the courier already owns", () => {
		expect(board).toContain("acceptingDeliveryId.current = offer.deliveryId");
		expect(board).toContain('failure.code === "CONFLICT"');
		expect(board).toContain("trpc.deliveries.mine.queryOptions()");
		expect(board).toContain("router.push(`/delivery/");
		expect(board).toContain('CONFLICT: "delivery.board.offers.busy"');
		expect(board).toContain('NOT_FOUND: "delivery.offer.unavailable"');
	});
});

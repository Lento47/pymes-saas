import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	actionFor,
	etaMinutes,
	formatOfferCountdown,
	headlineKind,
	kmFromMeters,
	remainingOfferMs,
} from "./courier-motion";

const root = join(import.meta.dir, "..");
const board = readFileSync(
	join(root, "app", "(delivery)", "delivery.tsx"),
	"utf8",
);
const detail = readFileSync(
	join(root, "app", "(delivery)", "delivery", "[id].tsx"),
	"utf8",
);
const tokens = readFileSync(join(root, "theme", "courier-motion.ts"), "utf8");
const slider = readFileSync(
	join(root, "components", "delivery-confirmation-slider.tsx"),
	"utf8",
);

describe("courier MOTION UI helpers", () => {
	test("countdown is remaining time from expiresAt, not a local origin", () => {
		const expires = new Date("2026-10-12T12:02:00.000Z");
		const now = Date.parse("2026-10-12T12:00:18.000Z");
		expect(remainingOfferMs(expires, now)).toBe(102_000);
		expect(formatOfferCountdown(102_000)).toBe("1:42");
		expect(
			remainingOfferMs(expires, Date.parse("2026-10-12T12:03:00.000Z")),
		).toBe(0);
	});

	test("ETA and distance stay blank when the order stored no quote", () => {
		expect(etaMinutes(null)).toBeNull();
		expect(etaMinutes(undefined)).toBeNull();
		expect(kmFromMeters(null)).toBeNull();
		expect(etaMinutes(480)).toBe(8);
		expect(kmFromMeters(2_400)).toBe(2.4);
	});

	test("headlines follow the delivery status rather than one composition", () => {
		expect(headlineKind("TO_PICKUP")).toBe("pickup");
		expect(headlineKind("PICKED_UP")).toBe("dropoff");
		expect(headlineKind("DELIVERED")).toBe("done");
		expect(actionFor("PICKED_UP")).toBe("COMPLETE");
		expect(actionFor("DELIVERED")).toBeNull();
	});
});

describe("courier MOTION UI composition", () => {
	test("the waiting board is editorial dispatch, not a stacked availability card", () => {
		expect(board).toContain("EditorialDispatchHero");
		expect(board).toContain("delivery.motion.offer.title");
		expect(board).toContain("motion.sheetInk");
		expect(board).toContain("OfferDestination");
		expect(board).toContain("CourierSheetSecondary");
		expect(board).toContain("<ScrollView");
		expect(board).toContain("Gesture.Pan()");
		expect(board).toContain("delivery.motion.slice.expand");
		expect(board).toContain("BoardSlice");
		expect(board).toContain('courierMotionTokens("waiting"');
		expect(board).not.toContain("AvailabilityCard");
		expect(board).not.toContain("<Switch");
		expect(board).not.toContain("Ganancias");
		expect(board).not.toContain("Próximas zonas");
		expect(board).not.toContain("NearbyDemandRail");
		expect(board).not.toContain("#4166F5");
	});

	test("the waiting board still recovers a refused accept onto a run the courier owns", () => {
		expect(board).toContain("acceptingDeliveryId.current = offer.deliveryId");
		expect(board).toContain('failure.code === "CONFLICT"');
		expect(board).toContain("trpc.deliveries.mine.queryOptions()");
		expect(board).toContain("router.push(`/delivery/");
		expect(board).toContain('CONFLICT: "delivery.board.offers.busy"');
		expect(board).toContain('NOT_FOUND: "delivery.offer.unavailable"');
	});

	test("active delivery is a light map canvas with a real completion slider", () => {
		expect(detail).toContain('courierMotionTokens("active"');
		expect(detail).toContain("DeliveryConfirmationSlider");
		expect(detail).toContain("<RouteStops");
		expect(detail).toContain("export function RouteStops");
		expect(detail).toContain("styles.mapTools");
		expect(detail).not.toContain("<BackButton");
		expect(detail).not.toContain("#4166F5");
		expect(slider).toContain("Gesture.Pan()");
		expect(slider).toContain("onComplete");
		expect(slider).toContain("useReducedMotion");
	});

	test("brand comes from colors.primary, never a frozen indigo", () => {
		expect(tokens).toContain("brand: colors.primary");
		expect(tokens).not.toMatch(/brand:\s*"#4166F5"/);
		expect(tokens).toContain('canvas: "#101827"');
		expect(tokens).toContain('canvas: "#FAFBFD"');
		expect(tokens).toContain('sheetInk: "#111827"');
		expect(tokens).toContain('sheetControl: "#F3F4F6"');
	});
});

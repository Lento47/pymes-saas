import { describe, expect, it } from "bun:test";
import {
	type DeliveryDraft,
	deliveryDraft,
	deliveryUpdate,
} from "./merchant-delivery-settings";

const draft: DeliveryDraft = {
	deliveryEnabled: true,
	pickupEnabled: true,
	deliveryPricingMode: "EXPRESS",
	merchantCoversDelivery: false,
	deliveryFeeMinor: "1500",
	deliveryRadiusKm: "2,5",
	prepTimeMinutes: "25",
	minOrderMinor: "3000",
};

describe("merchant delivery settings", () => {
	it("keeps automatic Express pricing free of a merchant-set fee", () => {
		const result = deliveryUpdate(draft, "CRC", false);
		expect(result.errors).toEqual({});
		expect(result.data).not.toHaveProperty("deliveryFeeMinor");
		expect(result.data?.deliveryRadiusKm).toBe(2.5);
		expect(result.data?.minOrderMinor).toBe(3000);
	});

	it("preserves minor units when displaying and saving a USD business", () => {
		const form = deliveryDraft({
			...draft,
			currency: "USD",
			canSetDeliveryFee: true,
			deliveryPricingMode: "AFFILIATED",
			deliveryFeeMinor: 1250,
			minOrderMinor: 2599,
			deliveryRadiusKm: 3,
			prepTimeMinutes: 15,
		});
		expect(form.deliveryFeeMinor).toBe("12.50");
		expect(form.minOrderMinor).toBe("25.99");
		const result = deliveryUpdate(form, "USD", true);
		expect(result.errors).toEqual({});
		expect(result.data?.deliveryFeeMinor).toBe(1250);
		expect(result.data?.minOrderMinor).toBe(2599);
	});

	it("removes an ineligible custom fee and requires a positive eligible fee", () => {
		const form = {
			...draft,
			deliveryPricingMode: "AFFILIATED" as const,
			deliveryFeeMinor: "0",
		};
		expect(deliveryUpdate(form, "CRC", false).data?.deliveryPricingMode).toBe(
			"EXPRESS",
		);
		expect(deliveryUpdate(form, "CRC", false).data).not.toHaveProperty(
			"deliveryFeeMinor",
		);
		expect(deliveryUpdate(form, "CRC", true).errors.deliveryFeeMinor).toBe(
			"biz.settings.delivery.courierFeeRequired",
		);
	});

	it("blocks invalid amounts, out-of-range numbers and disabling all fulfillment", () => {
		for (const change of [
			{ minOrderMinor: "abc" },
			{ minOrderMinor: "-1" },
			{ deliveryRadiusKm: "81" },
			{ prepTimeMinutes: "601" },
			{ prepTimeMinutes: "2.5" },
			{ deliveryEnabled: false, pickupEnabled: false },
		])
			expect(
				Object.keys(
					deliveryUpdate({ ...draft, ...change }, "CRC", false).errors,
				).length,
			).toBeGreaterThan(0);
	});

	it("does not block pickup-only saves on hidden delivery fields", () => {
		const result = deliveryUpdate(
			{
				...draft,
				deliveryEnabled: false,
				deliveryPricingMode: "AFFILIATED",
				deliveryFeeMinor: "abc",
				deliveryRadiusKm: "abc",
			},
			"CRC",
			true,
		);
		expect(result.errors).toEqual({});
		expect(result.data).not.toHaveProperty("deliveryFeeMinor");
		expect(result.data).not.toHaveProperty("deliveryRadiusKm");
	});
});

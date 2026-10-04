import { afterEach, describe, expect, test } from "bun:test";

import {
	clearOfferSelection,
	getOfferSelection,
	offerForBusiness,
	rememberOfferSelection,
} from "./offer-intent";

afterEach(clearOfferSelection);

const discount = (code: string) => ({
	code,
	kind: "PERCENT" as const,
	value: 35,
	currency: "CRC" as const,
	minOrderMinor: 1_500,
});

describe("selected offer", () => {
	test("starts empty and follows the business that advertised it", () => {
		expect(getOfferSelection()).toBeNull();
		rememberOfferSelection("shop-one", discount("SAVE35"));
		expect(offerForBusiness(getOfferSelection(), "shop-one")?.code).toBe(
			"SAVE35",
		);
		expect(offerForBusiness(getOfferSelection(), "shop-one")).toMatchObject(
			discount("SAVE35"),
		);
		expect(offerForBusiness(getOfferSelection(), "shop-two")).toBeNull();
	});

	test("replaces an earlier offer rather than presenting both", () => {
		rememberOfferSelection("shop-one", discount("FIRST"));
		rememberOfferSelection("shop-two", discount("SECOND"));
		expect(offerForBusiness(getOfferSelection(), "shop-one")).toBeNull();
		expect(offerForBusiness(getOfferSelection(), "shop-two")?.code).toBe(
			"SECOND",
		);
	});

	test("does not suggest a code after the shopping window expires", () => {
		const offer = {
			businessId: "shop-one",
			...discount("SAVE35"),
			selectedAt: 1_000,
		};
		expect(offerForBusiness(offer, "shop-one", 1_000)).toBe(offer);
		expect(offerForBusiness(offer, "shop-one", 1_201_000)).toBeNull();
	});

	test("clears the selected offer once handled", () => {
		rememberOfferSelection("shop-one", discount("SAVE35"));
		clearOfferSelection();
		expect(getOfferSelection()).toBeNull();
	});
});

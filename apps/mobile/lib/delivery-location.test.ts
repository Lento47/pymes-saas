import { describe, expect, test } from "bun:test";
import type { Address } from "@pymeshub/shared";
import { deliveryAddressForPin } from "./delivery-location";

const home: Address = {
	id: "adr_home",
	label: "Home",
	line1: "Street 1",
	city: "Limón",
	region: "Limón",
	country: "CR",
	isDefault: true,
	createdAt: new Date(0),
	instructions: "Blue gate",
};

describe("default delivery map point", () => {
	test("completes a legacy default address using the point the customer already chose", () => {
		expect(
			deliveryAddressForPin([home], { lat: 9.99, lng: -83.04 }, "Map pin"),
		).toMatchObject({
			id: "adr_home",
			lat: 9.99,
			lng: -83.04,
			line1: "Street 1",
			instructions: "Blue gate",
			isDefault: true,
		});
	});
	test("does not relocate an existing saved place when a different point is selected", () => {
		const result = deliveryAddressForPin(
			[{ ...home, lat: 10, lng: -83 }],
			{ lat: 9.99, lng: -83.04 },
			"Map pin",
		);
		expect(result.id).toBeUndefined();
		expect(result.instructions).toBeUndefined();
		expect(result).toMatchObject({
			label: "Map pin",
			city: "",
			region: "",
			lat: 9.99,
			lng: -83.04,
		});
	});
	test("reuses the same point, including zero, instead of duplicating an address", () => {
		expect(
			deliveryAddressForPin(
				[{ ...home, lat: 0, lng: 0, isDefault: false }],
				{ lat: 0, lng: 0 },
				"Map pin",
			),
		).toMatchObject({ id: "adr_home", isDefault: true });
	});
});

import { describe, expect, test } from "bun:test";

import {
	operationalDiscountMinor,
	routeFeeMinor,
} from "../src/services/delivery-pricing";
import {
	createOsrmRouting,
	RoutingUnavailableError,
} from "../src/services/routing";

const origin = { lat: 9.93, lng: -84.08 };
const destination = { lat: 9.94, lng: -84.09 };
const endpoint = "https://routes.example.test/";

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status });
}

describe("OSRM road routing boundary", () => {
	test("returns validated metres, seconds, and GeoJSON in longitude-latitude order", async () => {
		let requested = "";
		const routing = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async (url) => {
				requested = String(url);
				return response({
					code: "Ok",
					routes: [
						{
							distance: 4_000,
							duration: 720,
							geometry: {
								type: "LineString",
								coordinates: [
									[-84.08, 9.93],
									[-84.085, 9.935],
									[-84.09, 9.94],
								],
							},
						},
					],
				});
			},
		});
		const route = await routing.route({ origin, destination, profile: "car" });
		expect(requested).toContain("/route/v1/driving/-84.08,9.93;-84.09,9.94");
		expect(requested).toContain("geometries=geojson");
		expect(route.distanceMeters).toBe(4_000);
		expect(route.durationSeconds).toBe(720);
		expect(route.geometry.coordinates[1]).toEqual([-84.085, 9.935]);
	});

	test("preserves unreachable matrix cells without inventing a straight-line ETA", async () => {
		const routing = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async () => response({ code: "Ok", durations: [[180, null]] }),
		});
		await expect(
			routing.matrix({
				origins: [origin],
				destinations: [destination, origin],
				profile: "car",
			}),
		).resolves.toEqual([[180, null]]);
	});

	test("rejects bad coordinates, unsupported vehicle graphs and provider output", async () => {
		const routing = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async () =>
				response({
					code: "Ok",
					routes: [
						{
							distance: Number.NaN,
							duration: 30,
							geometry: { type: "LineString", coordinates: [[-84.08, 9.93]] },
						},
					],
				}),
		});
		await expect(
			routing.route({
				origin: { lat: 91, lng: 0 },
				destination,
				profile: "car",
			}),
		).rejects.toThrow(RangeError);
		await expect(
			routing.route({ origin, destination, profile: "motorcycle" }),
		).rejects.toThrow(RoutingUnavailableError);
		await expect(
			routing.route({ origin, destination, profile: "car" }),
		).rejects.toThrow(RoutingUnavailableError);
	});

	test("fails closed on timeout, provider failure and malformed matrix", async () => {
		const timeout = createOsrmRouting({
			baseUrl: endpoint,
			timeoutMs: 1,
			fetcher: async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init.signal?.addEventListener("abort", () =>
						reject(new Error("timeout")),
					);
				}),
		});
		await expect(
			timeout.route({ origin, destination, profile: "car" }),
		).rejects.toThrow(RoutingUnavailableError);
		const down = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async () => {
				throw new Error("offline");
			},
		});
		await expect(
			down.route({ origin, destination, profile: "car" }),
		).rejects.toThrow(RoutingUnavailableError);
		const noRoute = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async () => response({ code: "NoRoute" }),
		});
		await expect(
			noRoute.route({ origin, destination, profile: "car" }),
		).rejects.toThrow(RoutingUnavailableError);
		const malformed = createOsrmRouting({
			baseUrl: endpoint,
			fetcher: async () => response({ code: "Ok", durations: [[-1]] }),
		});
		await expect(
			malformed.matrix({
				origins: [origin],
				destinations: [destination],
				profile: "car",
			}),
		).rejects.toThrow(RoutingUnavailableError);
	});
});

describe("express road fee", () => {
	test("prices four road kilometres and twelve driving minutes at ₡2,310", () => {
		expect(routeFeeMinor(4_000, 720)).toBe(2_310);
	});

	test("caps discounts by eligibility and actual contribution margin", () => {
		const base = {
			feeMinor: 2_310,
			availableMarginMinor: 1_000,
		};
		expect(
			operationalDiscountMinor({
				...base,
				nearbyCourierEligible: false,
				orderAlreadyReady: true,
			}),
		).toBe(0);
		expect(
			operationalDiscountMinor({
				...base,
				nearbyCourierEligible: true,
				orderAlreadyReady: false,
			}),
		).toBe(231);
		expect(
			operationalDiscountMinor({
				...base,
				nearbyCourierEligible: true,
				orderAlreadyReady: true,
			}),
		).toBe(347);
		expect(
			operationalDiscountMinor({
				...base,
				availableMarginMinor: 200,
				nearbyCourierEligible: true,
				orderAlreadyReady: true,
			}),
		).toBe(200);
	});
});

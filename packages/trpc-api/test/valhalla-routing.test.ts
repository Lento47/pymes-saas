import { expect, test } from "bun:test";

import {
	createRouting,
	createValhallaRouting,
	RoutingUnavailableError,
} from "../src/services/routing";

const origin = { lat: 9.93, lng: -84.08 };
const destination = { lat: 9.94, lng: -84.09 };

test("Valhalla routes motorcycles and validates OSRM-format road geometry", async () => {
	let routeRequest: { path: string; method: string; body: unknown } | null =
		null;
	const routing = createRouting({
		baseUrl: "https://valhalla.example.test/",
		provider: "valhalla",
		fetcher: async (url, init) => {
			routeRequest = {
				path: url.pathname,
				method: init.method ?? "GET",
				body: JSON.parse(String(init.body)),
			};
			return Response.json({
				code: "Ok",
				routes: [
					{
						distance: 4_000,
						duration: 720,
						geometry: {
							type: "LineString",
							coordinates: [
								[origin.lng, origin.lat],
								[destination.lng, destination.lat],
							],
						},
					},
				],
			});
		},
	});
	const result = await routing.route({
		origin,
		destination,
		profile: "motorcycle",
	});
	expect(routeRequest).toMatchObject({
		path: "/route",
		method: "POST",
		body: {
			locations: [
				{ lat: origin.lat, lon: origin.lng },
				{ lat: destination.lat, lon: destination.lng },
			],
			costing: "motorcycle",
			format: "osrm",
			shape_format: "geojson",
		},
	});
	expect(result.provider).toBe("valhalla");
	expect(result.distanceMeters).toBe(4_000);
	expect(result.geometry.coordinates[0]).toEqual([origin.lng, origin.lat]);
});

test("Valhalla matrix preserves unreachable cells and rejects bad durations", async () => {
	let requested: { path: string; body: unknown } | null = null;
	const routing = createValhallaRouting({
		baseUrl: "https://valhalla.example.test/",
		fetcher: async (url, init) => {
			requested = { path: url.pathname, body: JSON.parse(String(init.body)) };
			return Response.json({
				sources_to_targets: { durations: [[180, null]] },
			});
		},
	});
	await expect(
		routing.matrix({
			origins: [origin],
			destinations: [destination, origin],
			profile: "bicycle",
		}),
	).resolves.toEqual([[180, null]]);
	expect(requested).toMatchObject({
		path: "/sources_to_targets",
		body: { costing: "bicycle", verbose: false },
	});
	const malformed = createValhallaRouting({
		baseUrl: "https://valhalla.example.test/",
		fetcher: async () =>
			Response.json({ sources_to_targets: { durations: [[-1]] } }),
	});
	await expect(
		malformed.matrix({
			origins: [origin],
			destinations: [destination],
			profile: "car",
		}),
	).rejects.toThrow(RoutingUnavailableError);
});

test("unknown providers and invalid Valhalla routes fail closed", async () => {
	expect(() =>
		createRouting({
			baseUrl: "https://routing.example.test/",
			provider: "unknown",
		}),
	).toThrow(RoutingUnavailableError);
	const invalid = createValhallaRouting({
		baseUrl: "https://valhalla.example.test/",
		fetcher: async () =>
			Response.json({ code: "Ok", routes: [{ distance: 1, duration: 0 }] }),
	});
	await expect(
		invalid.route({ origin, destination, profile: "car" }),
	).rejects.toThrow(RoutingUnavailableError);
});

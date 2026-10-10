import { haversineKm } from "@pymeshub/db/geo";

import { createOsrmRouting, type GeoPoint } from "../src/services/routing";

// Public city-centre samples only. Replace these with locally checked street pins
// before making a pricing decision; never put customer addresses in this file.
const trips: { name: string; origin: GeoPoint; destination: GeoPoint }[] = [
	{
		name: "San José urban",
		origin: { lat: 9.9348, lng: -84.0907 },
		destination: { lat: 9.9363, lng: -84.1075 },
	},
	{
		name: "Limón coastal",
		origin: { lat: 9.9912, lng: -83.0355 },
		destination: { lat: 9.9852, lng: -83.0247 },
	},
	{
		name: "Liberia to Tamarindo",
		origin: { lat: 10.6346, lng: -85.4381 },
		destination: { lat: 10.2999, lng: -85.837 },
	},
];

const baseUrl = process.env.ROUTING_BASE_URL;
if (!baseUrl) {
	console.error(
		"Set ROUTING_BASE_URL to an operator-controlled HTTPS OSRM endpoint.",
	);
	process.exit(2);
}

const routing = createOsrmRouting({ baseUrl });
let failures = 0;
const latencies: number[] = [];
const routeDurations = new Map<string, number>();

for (const trip of trips) {
	const startedAt = performance.now();
	try {
		const route = await routing.route({
			origin: trip.origin,
			destination: trip.destination,
			profile: "car",
		});
		const latencyMs = Math.round(performance.now() - startedAt);
		latencies.push(latencyMs);
		routeDurations.set(trip.name, route.durationSeconds);
		const directMeters = haversineKm(trip.origin, trip.destination) * 1_000;
		console.log(
			JSON.stringify({
				trip: trip.name,
				status: "ok",
				latencyMs,
				distanceMeters: Math.round(route.distanceMeters),
				durationSeconds: Math.round(route.durationSeconds),
				roadToDirectRatio: Number(
					(route.distanceMeters / directMeters).toFixed(2),
				),
				geometryPoints: route.geometry.coordinates.length,
			}),
		);
	} catch (error) {
		failures++;
		console.error(
			JSON.stringify({
				trip: trip.name,
				status: "failed",
				reason: error instanceof Error ? error.name : "UnknownError",
			}),
		);
	}
}

const matrixStartedAt = performance.now();
try {
	const durations = await routing.matrix({
		origins: trips.map((trip) => trip.origin),
		destinations: trips.map((trip) => trip.destination),
		profile: "car",
	});
	const diagonal = durations.map((row, index) => row[index]);
	if (
		diagonal.some((duration, index) => {
			const routeDuration = routeDurations.get(trips[index]?.name ?? "");
			return (
				duration == null ||
				(routeDuration !== undefined &&
					Math.abs(duration - routeDuration) >
						Math.max(60, routeDuration * 0.2))
			);
		})
	) {
		throw new Error("Unreachable or inconsistent sample trip in matrix");
	}
	console.log(
		JSON.stringify({
			check: "matrix",
			status: "ok",
			latencyMs: Math.round(performance.now() - matrixStartedAt),
			matchedTrips: diagonal.length,
		}),
	);
} catch (error) {
	failures++;
	console.error(
		JSON.stringify({
			check: "matrix",
			status: "failed",
			reason: error instanceof Error ? error.name : "UnknownError",
		}),
	);
}

const sorted = latencies.sort((a, b) => a - b);
console.log(
	JSON.stringify({
		check: "summary",
		passed: trips.length + 1 - failures,
		failed: failures,
		p95RouteLatencyMs: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
	}),
);
if (failures > 0) process.exitCode = 1;

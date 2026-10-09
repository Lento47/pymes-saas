/** A road-routing boundary. No caller may treat a straight-line distance as a priced route. */
export type GeoPoint = { lat: number; lng: number };
export type TravelProfile = "car" | "motorcycle" | "bicycle";
export type RouteGeometry = {
	type: "LineString";
	coordinates: [number, number][];
};
export type RouteResult = {
	distanceMeters: number;
	durationSeconds: number;
	geometry: RouteGeometry;
	provider: "osrm";
	calculatedAt: Date;
};

export interface RoutingPort {
	route(input: {
		origin: GeoPoint;
		destination: GeoPoint;
		profile: TravelProfile;
	}): Promise<RouteResult>;
	matrix(input: {
		origins: GeoPoint[];
		destinations: GeoPoint[];
		profile: TravelProfile;
	}): Promise<Array<Array<number | null>>>;
}

export class RoutingUnavailableError extends Error {
	constructor(message = "Road routing is unavailable") {
		super(message);
		this.name = "RoutingUnavailableError";
	}
}

const MAX_MATRIX_POINTS = 16;
const MAX_ROUTE_POINTS = 10_000;
const DEFAULT_TIMEOUT_MS = 3_000;

function validPoint(point: GeoPoint): boolean {
	return (
		Number.isFinite(point.lat) &&
		Number.isFinite(point.lng) &&
		Math.abs(point.lat) <= 90 &&
		Math.abs(point.lng) <= 180
	);
}

function assertPoints(points: GeoPoint[]): void {
	if (points.length === 0 || points.some((point) => !validPoint(point))) {
		throw new RangeError("Invalid routing coordinates");
	}
}

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function metric(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function geometryOf(value: unknown): RouteGeometry | null {
	const shape = record(value);
	if (shape?.type !== "LineString" || !Array.isArray(shape.coordinates))
		return null;
	if (
		shape.coordinates.length < 2 ||
		shape.coordinates.length > MAX_ROUTE_POINTS
	)
		return null;
	const coordinates: [number, number][] = [];
	for (const coordinate of shape.coordinates) {
		if (!Array.isArray(coordinate) || coordinate.length !== 2) return null;
		const [lng, lat] = coordinate;
		if (!validPoint({ lat, lng })) return null;
		coordinates.push([lng, lat]);
	}
	return { type: "LineString", coordinates };
}

/**
 * OSRM's graph is compiled for one vehicle profile. This adapter only promises car routes;
 * passing a motorcycle or bicycle request to a driving graph would invent road access.
 * Configure an operator-controlled HTTPS endpoint, never the public demo server.
 */
export function createOsrmRouting(input: {
	baseUrl: string;
	fetcher?: (url: URL, init: RequestInit) => Promise<Response>;
	timeoutMs?: number;
}): RoutingPort {
	const base = new URL(input.baseUrl);
	if (
		base.protocol !== "https:" ||
		base.username ||
		base.password ||
		base.search ||
		base.hash
	)
		throw new Error("Routing endpoint must be an HTTPS origin");
	const fetcher = input.fetcher ?? fetch;
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
		throw new RangeError("Invalid routing timeout");

	async function request(path: string): Promise<Record<string, unknown>> {
		let response: Response;
		try {
			response = await fetcher(new URL(path, base), {
				signal: AbortSignal.timeout(timeoutMs),
				redirect: "error",
			});
		} catch {
			throw new RoutingUnavailableError();
		}
		if (!response.ok) throw new RoutingUnavailableError();
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new RoutingUnavailableError("Invalid routing response");
		}
		const data = record(body);
		if (data?.code !== "Ok") throw new RoutingUnavailableError();
		return data;
	}

	function assertProfile(profile: TravelProfile): void {
		if (profile !== "car")
			throw new RoutingUnavailableError(`No ${profile} road graph configured`);
	}

	function pair(point: GeoPoint): string {
		return `${point.lng},${point.lat}`;
	}

	return {
		async route({ origin, destination, profile }) {
			assertProfile(profile);
			assertPoints([origin, destination]);
			const data = await request(
				`route/v1/driving/${pair(origin)};${pair(destination)}?overview=full&geometries=geojson&steps=false`,
			);
			const routes = data.routes;
			const first = Array.isArray(routes) ? record(routes[0]) : null;
			const geometry = geometryOf(first?.geometry);
			if (
				!first ||
				!metric(first.distance) ||
				!metric(first.duration) ||
				!geometry
			)
				throw new RoutingUnavailableError("Invalid road route");
			return {
				distanceMeters: first.distance,
				durationSeconds: first.duration,
				geometry,
				provider: "osrm",
				calculatedAt: new Date(),
			};
		},
		async matrix({ origins, destinations, profile }) {
			assertProfile(profile);
			assertPoints(origins);
			assertPoints(destinations);
			if (origins.length + destinations.length > MAX_MATRIX_POINTS)
				throw new RangeError("Routing matrix is too large");
			const points = [...origins, ...destinations];
			const sources = origins.map((_, index) => index).join(";");
			const targets = destinations
				.map((_, index) => origins.length + index)
				.join(";");
			const data = await request(
				`table/v1/driving/${points.map(pair).join(";")}?sources=${sources}&destinations=${targets}`,
			);
			if (
				!Array.isArray(data.durations) ||
				data.durations.length !== origins.length
			)
				throw new RoutingUnavailableError("Invalid routing matrix");
			return data.durations.map((row) => {
				if (
					!Array.isArray(row) ||
					row.length !== destinations.length ||
					row.some((value) => value !== null && !metric(value))
				)
					throw new RoutingUnavailableError("Invalid routing matrix");
				return row as Array<number | null>;
			});
		},
	};
}

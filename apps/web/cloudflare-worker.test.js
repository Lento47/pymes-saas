// @vitest-environment node
/**
 * Worker tests for `cloudflare-worker.js`.
 *
 * The load-bearing assertion is `parseRange` + the response-shape cases at the
 * bottom: **a request carrying a `Range` header must never be answered with `200`**.
 * maplibre-native#4374 is what that rule buys — `HTTPFileSource` buffers a body in
 * full before reading the status code, so one `200` in place of a `206` allocates
 * the entire archive in RAM and OOM-crashes the client while the map stays blank.
 * It happened in production behind the Cloudflare CDN. These cases are that bug made
 * mechanical so it cannot come back through a refactor.
 */
import { describe, expect, it } from "vitest";

import worker, { parseRange, substituteBase } from "./cloudflare-worker.js";

/** Bytes of an object; only the length matters to the range logic. */
function bytes(n) {
	return new Uint8Array(n);
}

/**
 * Minimal stand-in for an `R2Bucket`. Enough to drive `head`/`get`, with the same
 * "returns null for a missing key" contract. Every key is recorded so a test can
 * assert what the router actually asked the bucket for.
 */
function fakeBucket(objects) {
	/** @type {string[]} */
	const requested = [];
	const record = (key) => {
		requested.push(key);
		return objects[key];
	};
	return {
		requested,
		async head(key) {
			const object = record(key);
			return object ? { key, size: object.length } : null;
		},
		async get(key, options) {
			const object = record(key);
			if (!object) return null;
			if (options?.range) {
				const { offset, length } = options.range;
				const slice = object.subarray(offset, offset + length);
				return {
					body: slice.slice().buffer,
					size: object.length,
					range: { offset, length },
				};
			}
			return { body: object.slice().buffer, size: object.length };
		},
	};
}

function request(path, init) {
	return new Request(`https://pymeshub.lat${path}`, init);
}

describe("parseRange", () => {
	it("returns null when no Range header was sent", () => {
		expect(parseRange(null, 100)).toBeNull();
		expect(parseRange(undefined, 100)).toBeNull();
		expect(parseRange("", 100)).toBeNull();
	});

	it("parses a closed range", () => {
		expect(parseRange("bytes=0-1023", 4096)).toEqual({ offset: 0, length: 1024 });
		expect(parseRange("bytes=100-199", 4096)).toEqual({ offset: 100, length: 100 });
	});

	it("parses an open-ended range to the end of the resource", () => {
		expect(parseRange("bytes=1024-", 4096)).toEqual({ offset: 1024, length: 3072 });
		expect(parseRange("bytes=0-", 10)).toEqual({ offset: 0, length: 10 });
	});

	it("parses a suffix range", () => {
		expect(parseRange("bytes=-500", 4096)).toEqual({ offset: 3596, length: 500 });
		// A suffix longer than the resource is the whole resource, not an error.
		expect(parseRange("bytes=-500", 100)).toEqual({ offset: 0, length: 100 });
	});

	it("clamps a last-byte-pos past the end of the resource", () => {
		// RFC 9110 §14.1.1: satisfiable, just truncated.
		expect(parseRange("bytes=0-999", 100)).toEqual({ offset: 0, length: 100 });
	});

	it("treats a first-byte-pos at or past the end as unsatisfiable", () => {
		expect(parseRange("bytes=999-", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=100-200", 100)).toBe("unsatisfiable");
		// An empty resource satisfies nothing.
		expect(parseRange("bytes=0-0", 0)).toBe("unsatisfiable");
		expect(parseRange("bytes=-1", 0)).toBe("unsatisfiable");
	});

	it("treats an inverted range as unsatisfiable", () => {
		expect(parseRange("bytes=500-100", 1000)).toBe("unsatisfiable");
		expect(parseRange("bytes=-0", 1000)).toBe("unsatisfiable");
	});

	it("rejects anything that is not a single bytes range", () => {
		// The rule is binary: a Range header must produce 206 or 416, never 200. So
		// anything we cannot honour is reported as unsatisfiable rather than ignored.
		expect(parseRange("items=0-10", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=0-1,5-6", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=abc-def", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=", 100)).toBe("unsatisfiable");
		expect(parseRange("bytes=0-10", 100)?.offset).toBe(0);
		expect(parseRange("garbage", 100)).toBe("unsatisfiable");
	});
});

describe("substituteBase", () => {
	it("replaces {BASE} in strings, including nested ones", () => {
		const doc = {
			glyphs: "{BASE}/api/map/glyphs/{fontstack}/{range}.pbf",
			sources: { p: { url: "pmtiles://{BASE}/api/map/basemap.pmtiles" } },
			layers: [{ id: "a" }],
		};
		const out = substituteBase(doc, "https://host.example");
		expect(out.glyphs).toBe("https://host.example/api/map/glyphs/{fontstack}/{range}.pbf");
		expect(out.sources.p.url).toBe("pmtiles://https://host.example/api/map/basemap.pmtiles");
		// MapLibre's own {fontstack} / {range} tokens must survive untouched.
		expect(out.glyphs).toContain("{fontstack}");
		expect(out.layers[0].id).toBe("a");
	});

	it("does not corrupt the document when the base contains JSON metacharacters", () => {
		// Walking the parsed tree rather than string-replacing the serialized form is
		// what makes this safe.
		const out = substituteBase({ u: "{BASE}/x" }, 'https://h"\\o');
		expect(JSON.parse(JSON.stringify(out)).u).toBe('https://h"\\o/x');
	});
});

describe("map routes", () => {
	const KEY = "map/basemap.pmtiles";
	const SIZE = 1000;

	const env = () => ({
		MAP_ASSETS: fakeBucket({ [KEY]: bytes(SIZE) }),
		ASSETS: {
			async fetch() {
				return new Response("SPA", { status: 200 });
			},
		},
	});

	it("serves the style document with {BASE} resolved to the request origin", async () => {
		const res = await worker.fetch(request("/api/map/style.json"), env());
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
		const body = await res.json();
		expect(body.sources.protomaps.url).toBe(
			"pmtiles://https://pymeshub.lat/api/map/basemap.pmtiles",
		);
		expect(body.glyphs).toBe("https://pymeshub.lat/api/map/glyphs/{fontstack}/{range}.pbf");
	});

	it("answers a full request without Range with 200", async () => {
		const res = await worker.fetch(request("/api/map/basemap.pmtiles"), env());
		expect(res.status).toBe(200);
		expect(res.headers.get("Accept-Ranges")).toBe("bytes");
		expect(res.headers.get("Content-Length")).toBe(String(SIZE));
		expect(res.headers.get("Content-Range")).toBeNull();
	});

	it("answers a Range request with 206 and a Content-Range", async () => {
		const res = await worker.fetch(
			request("/api/map/basemap.pmtiles", { headers: { Range: "bytes=0-99" } }),
			env(),
		);
		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Range")).toBe(`bytes 0-99/${SIZE}`);
		expect(res.headers.get("Content-Length")).toBe("100");
		expect((await res.arrayBuffer()).byteLength).toBe(100);
	});

	it("never answers a Range request with 200", async () => {
		// The maplibre-native#4374 invariant, asserted directly.
		const headers = [
			"bytes=0-99",
			"bytes=0-",
			"bytes=-50",
			"bytes=999-",
			"bytes=0-99999",
			"bytes=0-1,5-6",
			"items=0-1",
			"garbage",
		];
		for (const header of headers) {
			const res = await worker.fetch(
				request("/api/map/basemap.pmtiles", { headers: { Range: header } }),
				env(),
			);
			expect(res.status, `Range: ${header}`).not.toBe(200);
			expect([206, 416], `Range: ${header}`).toContain(res.status);
		}
	});

	it("answers an unsatisfiable range with 416 and no body of the object", async () => {
		const res = await worker.fetch(
			request("/api/map/basemap.pmtiles", { headers: { Range: "bytes=9999-" } }),
			env(),
		);
		expect(res.status).toBe(416);
		expect(res.headers.get("Content-Range")).toBe(`bytes */${SIZE}`);
	});

	it("does not let the edge cache the archive", async () => {
		// A cached 200 is how #4374 returns after the handler is correct. `private`
		// keeps Cloudflare from caching it while still letting the client keep ranges.
		const res = await worker.fetch(request("/api/map/basemap.pmtiles"), env());
		expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");
		expect(res.headers.get("Cache-Control")).not.toContain("public");
	});

	it("supports HEAD without a body", async () => {
		const res = await worker.fetch(
			request("/api/map/basemap.pmtiles", {
				method: "HEAD",
				headers: { Range: "bytes=0-99" },
			}),
			env(),
		);
		expect(res.status).toBe(206);
		expect(res.headers.get("Content-Length")).toBe("100");
		expect((await res.arrayBuffer()).byteLength).toBe(0);
	});

	it("answers CORS preflight", async () => {
		const res = await worker.fetch(request("/api/map/basemap.pmtiles", { method: "OPTIONS" }), env());
		expect(res.status).toBe(204);
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Range");
		expect(res.headers.get("Access-Control-Expose-Headers")).toContain("Content-Range");
	});

	it("rejects methods other than GET/HEAD/OPTIONS", async () => {
		const res = await worker.fetch(request("/api/map/basemap.pmtiles", { method: "POST" }), env());
		expect(res.status).toBe(405);
	});

	it("serves glyphs with immutable caching", async () => {
		const bucket = fakeBucket({
			"map/glyphs/Noto Sans Regular/0-255.pbf": bytes(10),
		});
		const res = await worker.fetch(
			request("/api/map/glyphs/Noto%20Sans%20Regular/0-255.pbf"),
			{ ...env(), MAP_ASSETS: bucket },
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
		expect(res.headers.get("Content-Type")).toBe("application/x-protobuf");
	});

	it("never asks the bucket for a key outside map/", async () => {
		// Two different defences, and the test has to account for both.
		//
		// Literal `..` segments never reach the router: `new URL()` folds
		// `/api/map/glyphs/../../x` down to `/api/x` before the pathname is read, so
		// those requests fall through to the SPA and are simply not map routes. That
		// is safe, and worth stating, because a test that only expects `404` would
		// fail against correct behaviour.
		//
		// Percent-encoded traversal is the live hole: `%2e%2e%2f` survives URL
		// normalization, passes the `[^/]+` fontstack match as literal characters,
		// and only becomes `../` at `decodeURIComponent`. The router must reject it.
		const archive = bytes(10);
		const bucket = fakeBucket({ "map/basemap.pmtiles": archive });
		const base = { ...env(), MAP_ASSETS: bucket };

		const hostile = [
			// encoded ../ — must not become a bucket key
			"/api/map/glyphs/%2e%2e%2f%2e%2e%2f/0-255.pbf",
			"/api/map/glyphs/x%2f..%2f..%2f/0-255.pbf",
			"/api/map/glyphs/a%2fb/0-255.pbf",
			"/api/map/glyphs/%2e%2e/0-255.pbf",
			// empty fontstack — the regex requires one character, so this never matches
			"/api/map/glyphs//0-255.pbf",
			// literal .. — folded away by the URL parser before the router sees it
			"/api/map/glyphs/../../basemap.pmtiles/0-255.pbf",
			"/api/map/glyphs/stack/0-255/../../../basemap.pmtiles",
		];

		for (const path of hostile) {
			const res = await worker.fetch(request(path), base);
			// Whatever the route decided, the archive must not have been served as a
			// glyph, and no bucket key may escape the map/ prefix.
			expect(res.status, path).not.toBe(206);
			for (const key of bucket.requested) {
				expect(key, `${path} -> ${key}`).toMatch(/^map\//);
				expect(key, `${path} -> ${key}`).not.toContain("..");
				expect(key, `${path} -> ${key}`).not.toContain("//");
			}
			bucket.requested.length = 0;
		}

		// The encoded forms are the ones that actually reach the glyph matcher, and
		// they must be refused there rather than looked up.
		for (const path of hostile.slice(0, 4)) {
			const res = await worker.fetch(request(path), base);
			expect(res.status, path).toBe(404);
		}
	});
});

describe("degradation", () => {
	it("returns 404 when the map bucket is not bound, without throwing", async () => {
		const env = {
			ASSETS: { async fetch() { return new Response("SPA", { status: 200 }); } },
		};
		const res = await worker.fetch(request("/api/map/basemap.pmtiles"), env);
		expect(res.status).toBe(404);
		expect(await res.text()).toContain("not configured");
	});

	it("returns 404 when the archive is missing, without throwing", async () => {
		const env = {
			MAP_ASSETS: fakeBucket({}),
			ASSETS: { async fetch() { return new Response("SPA", { status: 200 }); } },
		};
		const res = await worker.fetch(request("/api/map/basemap.pmtiles"), env);
		expect(res.status).toBe(404);
	});

	it("returns 404 for an unknown /api/map path instead of falling through to the SPA", async () => {
		// `not_found_handling = "single-page-application"` would hand back index.html
		// here, and MapLibre would try to parse it as a PBF.
		const env = {
			MAP_ASSETS: fakeBucket({ "map/basemap.pmtiles": bytes(10) }),
			ASSETS: { async fetch() { return new Response("SPA", { status: 200 }); } },
		};
		for (const path of ["/api/map/sprite", "/api/map/nope", "/api/map/glyphs/x/y.pbf"]) {
			const res = await worker.fetch(request(path), env);
			expect(res.status, path).toBe(404);
			expect(await res.text(), path).not.toBe("SPA");
		}
	});

	it("leaves every non-map path to the asset handler", async () => {
		let hitAssets = 0;
		const env = {
			MAP_ASSETS: fakeBucket({}),
			ASSETS: {
				async fetch() {
					hitAssets += 1;
					return new Response("SPA", { status: 200 });
				},
			},
		};
		for (const path of ["/", "/index.html", "/api", "/api/things", "/apimap/style.json"]) {
			const res = await worker.fetch(request(path), env);
			expect(res.status, path).toBe(200);
			expect(await res.text(), path).toBe("SPA");
		}
		expect(hitAssets).toBe(5);
	});
});

/**
 * Worker behind `pymeshub.lat` (and any other hostname bound to `pymeshubsaas`).
 *
 * Two jobs, in this order:
 *
 * 1. Serve the MapLibre basemap under `/api/map/*` out of R2. The PMTiles archive is
 *    far past the 25 MiB per-file cap that Workers static assets impose, so it lives
 *    in R2 and is streamed back over HTTP byte ranges — which is how PMTiles works:
 *    the client asks for a few kilobytes of directory and tile data at a time and
 *    never downloads the file. See `docs/technical/map-hosting.md`.
 * 2. Everything else falls through to the SPA in `ASSETS`, unchanged.
 *
 * Map routes are **owned** by this router: an unrecognised `/api/map/…` path returns
 * a map 404 rather than falling through to `ASSETS`. That matters because
 * `not_found_handling = "single-page-application"` would hand back `index.html` for
 * a mistyped glyph path, and MapLibre would fail to parse it as a PBF with a
 * confusing error instead of a missing-file signal.
 */

import styleDoc from "./map/style.json";

const MAP_PREFIX = "/api/map";
const ARCHIVE_KEY = "map/basemap.pmtiles";
const ARCHIVE_CONTENT_TYPE = "application/vnd.pmtiles";

/**
 * `bytes=a-b`, `bytes=a-`, `bytes=-N`. A Range header with any other unit, a
 * multi-range (`bytes=0-1,5-6`), or a spec that cannot be satisfied is reported as
 * `"unsatisfiable"` — the caller turns that into a `416`.
 *
 * The alternative of ignoring a header we cannot honour and answering `200` is
 * deliberately not taken. See `RANGE_MUST_BE_PARTIAL` below.
 */
const RANGE_SPEC = /^bytes=(.+)$/i;

/**
 * Why a Range request must never be answered with `200`.
 *
 * maplibre-native#4374: `HTTPFileSource` buffers a response body in full *before*
 * it looks at the status code. A `Range: bytes=0-126` probe answered with `200` and
 * the whole file therefore allocates the entire archive in RAM. In production this
 * happened through the Cloudflare CDN against a ~83 GB PMTiles archive and
 * OOM-crashed the client while the map stayed blank.
 *
 * So the invariant this file exists to keep is binary and non-negotiable:
 *
 *   request has no `Range` header  ->  `200`
 *   request has a `Range` header   ->  `206` or `416`, never `200`
 *
 * The archive is also never written to `caches.default` and is served with
 * `Cache-Control: private`, because a *cached* `200` is exactly how the bug
 * resurfaces after the handler gets this right. The archive is immutable, so
 * `max-age` still lets the client keep ranges it has already fetched; `private` is
 * what stops the edge from turning a range read into a full-object read.
 */
const ARCHIVE_CACHE_CONTROL = "private, max-age=86400";

/**
 * Glyph and sprite bytes are small and immutable — unlike the archive they are safe
 * to let the edge cache, and worth it.
 */
const STATIC_MAP_CACHE_CONTROL = "public, max-age=31536000, immutable";

const STYLE_CACHE_CONTROL = "public, max-age=300";

/**
 * `/api/map/glyphs/{fontstack}/{range}.pbf`. Both path segments are matched tightly:
 * the fontstack may contain spaces and commas but never a slash, and the range is
 * always a `0-255`-shaped pair. Anything else is a 404 rather than an R2 key — a
 * looser match here is a path-traversal surface into the bucket.
 */
const GLYPH_PATH = /^\/api\/map\/glyphs\/([^/]+)\/(\d+-\d+)\.pbf$/;

/** `/api/map/sprite{@2x}.{json,png}`. MapLibre appends these to the style's sprite URL. */
const SPRITE_PATH = /^\/api\/map\/sprite(@2x)?\.(json|png)$/;

/**
 * Parse a `Range` header against a known resource size.
 *
 * @param {string | null | undefined} header raw `Range` header value
 * @param {number} size total size of the resource in bytes
 * @returns {null | "unsatisfiable" | { offset: number, length: number }}
 *   `null` when no `Range` header was sent (answer `200`),
 *   `"unsatisfiable"` when a header was sent that cannot be honoured (answer `416`),
 *   otherwise the exact byte window to read.
 */
export function parseRange(header, size) {
	if (header === null || header === undefined || header === "") return null;

	const match = RANGE_SPEC.exec(header.trim());
	if (!match) return "unsatisfiable";

	const spec = match[1].trim();
	// Multi-range is legal HTTP and never sent by a PMTiles client. Answering it
	// properly means multipart/byteranges; answering `200` is the OOM bug. 416 is
	// the safe reading.
	if (spec.includes(",")) return "unsatisfiable";

	const dash = spec.indexOf("-");
	if (dash < 0) return "unsatisfiable";

	const startText = spec.slice(0, dash).trim();
	const endText = spec.slice(dash + 1).trim();

	// `bytes=-N`: the final N bytes.
	if (startText === "") {
		if (!/^\d+$/.test(endText)) return "unsatisfiable";
		const suffix = Number(endText);
		if (suffix === 0) return "unsatisfiable";
		if (size === 0) return "unsatisfiable";
		const length = Math.min(suffix, size);
		return { offset: size - length, length };
	}

	if (!/^\d+$/.test(startText)) return "unsatisfiable";
	const offset = Number(startText);
	// A first-byte-pos at or past the end is unsatisfiable, including on an empty
	// resource.
	if (offset >= size) return "unsatisfiable";

	// `bytes=a-`: from a to the end.
	if (endText === "") return { offset, length: size - offset };

	if (!/^\d+$/.test(endText)) return "unsatisfiable";
	const end = Number(endText);
	if (end < offset) return "unsatisfiable";
	// A last-byte-pos past the end is clamped, not unsatisfiable — RFC 9110 §14.1.1.
	const last = Math.min(end, size - 1);
	return { offset, length: last - offset + 1 };
}

/**
 * Replace the `{BASE}` placeholder the style was generated with. Done by walking the
 * parsed document rather than string-replacing the serialized form, so a substituted
 * host containing a quote or backslash cannot corrupt the JSON.
 *
 * @param {unknown} value
 * @param {string} base
 * @returns {unknown}
 */
export function substituteBase(value, base) {
	if (typeof value === "string") return value.replaceAll("{BASE}", base);
	if (Array.isArray(value)) return value.map((entry) => substituteBase(entry, base));
	if (value !== null && typeof value === "object") {
		/** @type {Record<string, unknown>} */
		const out = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = substituteBase(entry, base);
		}
		return out;
	}
	return value;
}

/**
 * CORS for the map routes. MapLibre Native ignores these entirely — it is not a
 * browser — but the web map at `apps/web/client/src/pages/map.tsx` is, and it lives
 * on the same origin today only by accident. Keeping the headers costs nothing and
 * unblocks a split deployment later.
 */
function withMapCors(headers) {
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Range");
	headers.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
	return headers;
}

function corsResponse() {
	return new Response(null, {
		status: 204,
		headers: withMapCors(new Headers()),
	});
}

function mapTextResponse(status, body, extraHeaders) {
	const headers = new Headers(extraHeaders);
	headers.set("Content-Type", "text/plain; charset=utf-8");
	return new Response(body, { status, headers: withMapCors(headers) });
}

/**
 * Serve an immutable R2 object, honouring byte ranges.
 *
 * @param {import("@cloudflare/workers-types").R2Bucket} bucket
 * @param {string} key
 * @param {string} contentType
 * @param {string} cacheControl
 * @param {Request} request
 */
async function serveObject(bucket, key, contentType, cacheControl, request) {
	const head = await bucket.head(key);
	if (head === null) return mapTextResponse(404, "not found\n");

	const size = head.size;
	const method = request.method.toUpperCase();
	const wantsBody = method === "GET";
	const rangeHeader = request.headers.get("Range");
	const range = parseRange(rangeHeader, size);

	// The invariant. A Range header that cannot produce a partial response must not
	// fall through to a full `200` — see `ARCHIVE_CACHE_CONTROL`.
	if (range === "unsatisfiable") {
		const headers = new Headers({
			"Content-Range": `bytes */${size}`,
			"Accept-Ranges": "bytes",
			"Cache-Control": cacheControl,
			"Content-Type": contentType,
		});
		return new Response(wantsBody ? "range not satisfiable\n" : null, {
			status: 416,
			headers: withMapCors(headers),
		});
	}

	const headers = new Headers({
		"Accept-Ranges": "bytes",
		"Cache-Control": cacheControl,
		"Content-Type": contentType,
	});

	if (range === null) {
		headers.set("Content-Length", String(size));
		if (!wantsBody) {
			return new Response(null, { status: 200, headers: withMapCors(headers) });
		}
		const object = await bucket.get(key);
		if (object === null) return mapTextResponse(404, "not found\n");
		return new Response(object.body, { status: 200, headers: withMapCors(headers) });
	}

	const end = range.offset + range.length - 1;
	headers.set("Content-Range", `bytes ${range.offset}-${end}/${size}`);
	headers.set("Content-Length", String(range.length));
	if (!wantsBody) {
		return new Response(null, { status: 206, headers: withMapCors(headers) });
	}
	const object = await bucket.get(key, {
		range: { offset: range.offset, length: range.length },
	});
	if (object === null) return mapTextResponse(404, "not found\n");
	return new Response(object.body, { status: 206, headers: withMapCors(headers) });
}

/**
 * Everything under `/api/map/`. Never falls through to `ASSETS`; always returns a
 * `Response`.
 *
 * @param {Request} request
 * @param {{ MAP_ASSETS?: import("@cloudflare/workers-types").R2Bucket }} env
 * @param {URL} url
 */
async function handleMap(request, env, url) {
	const method = request.method.toUpperCase();
	if (method === "OPTIONS") return corsResponse();
	if (method !== "GET" && method !== "HEAD") {
		return mapTextResponse(405, "method not allowed\n", { Allow: "GET, HEAD, OPTIONS" });
	}

	const bucket = env.MAP_ASSETS;
	const path = url.pathname;

	// Style document. Inlined at bundle time from `apps/web/map/style.json`, with the
	// request's own origin substituted so one committed file serves every host.
	if (path === `${MAP_PREFIX}/style.json` || path === `${MAP_PREFIX}/style`) {
		const base = url.origin;
		const body = JSON.stringify(substituteBase(styleDoc, base));
		const headers = new Headers({
			"Cache-Control": STYLE_CACHE_CONTROL,
			"Content-Type": "application/json; charset=utf-8",
		});
		return new Response(method === "HEAD" ? null : body, {
			status: 200,
			headers: withMapCors(headers),
		});
	}

	// A missing binding must not take the SPA down with it. Same rule
	// `apps/mobile/components/map.tsx` and `apps/mobile/lib/env.ts` follow: a missing
	// capability removes the capability, and never throws.
	if (!bucket) return mapTextResponse(404, "map storage not configured\n");

	if (path === `${MAP_PREFIX}/basemap.pmtiles`) {
		try {
			return await serveObject(
				bucket,
				ARCHIVE_KEY,
				ARCHIVE_CONTENT_TYPE,
				ARCHIVE_CACHE_CONTROL,
				request,
			);
		} catch {
			// R2 blips surface as a map 404, not as an exception that would unwind
			// into the asset handler and 500 the whole worker.
			return mapTextResponse(404, "not found\n");
		}
	}

	const glyph = GLYPH_PATH.exec(path);
	if (glyph) {
		let stack;
		try {
			stack = decodeURIComponent(glyph[1]);
		} catch {
			return mapTextResponse(404, "not found\n");
		}
		// A fontstack is a name, never a path. The raw pathname is already matched
		// with `[^/]+`, but that is not enough on its own: `%2f` passes the regex as
		// three literal characters and only becomes a slash at `decodeURIComponent`,
		// and `%2e%2e` similarly becomes `..` after matching. Literal `..` segments
		// never get this far — `new URL()` folds them away before the router sees the
		// path — but the encoded form does, so the decoded value is checked too. R2
		// keys are opaque and would not resolve `..`, but building a bucket key out of
		// unvalidated input is still the wrong shape to ship.
		if (stack === "" || stack.includes("/") || stack.includes("\\") || stack.includes("..")) {
			return mapTextResponse(404, "not found\n");
		}
		const key = `map/glyphs/${stack}/${glyph[2]}.pbf`;
		try {
			return await serveObject(
				bucket,
				key,
				"application/x-protobuf",
				STATIC_MAP_CACHE_CONTROL,
				request,
			);
		} catch {
			return mapTextResponse(404, "not found\n");
		}
	}

	const sprite = SPRITE_PATH.exec(path);
	if (sprite) {
		const key = `map/sprite${sprite[1] ?? ""}.${sprite[2]}`;
		try {
			return await serveObject(
				bucket,
				key,
				sprite[2] === "png" ? "image/png" : "application/json; charset=utf-8",
				STATIC_MAP_CACHE_CONTROL,
				request,
			);
		} catch {
			return mapTextResponse(404, "not found\n");
		}
	}

	// Any other `/api/map/…` path. Deliberately not `ASSETS`: SPA not-found handling
	// would return `index.html` and MapLibre would try to read it as tile data.
	return mapTextResponse(404, "not found\n");
}

export default {
	/**
	 * @param {Request} request
	 * @param {{ MAP_ASSETS?: unknown, ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
	 */
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === MAP_PREFIX || url.pathname.startsWith(`${MAP_PREFIX}/`)) {
			return handleMap(request, env, url);
		}
		return env.ASSETS.fetch(request);
	},
};

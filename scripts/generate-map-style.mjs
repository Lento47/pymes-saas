#!/usr/bin/env node
/**
 * Regenerates `apps/web/map/style.json`, the MapLibre style document served at
 * `/api/map/style.json` by `apps/web/cloudflare-worker.js`.
 *
 * Run this when the tile archive's schema or the `@protomaps/basemaps` version
 * changes — **not** on every deploy. The output is committed so `wrangler deploy`
 * needs no generator dependency and the Worker can inline the document at bundle
 * time.
 *
 *     node scripts/generate-map-style.mjs
 *
 * The document is written with `{BASE}` placeholders where a host would go. The
 * Worker substitutes the request's own origin at serve time, so one committed
 * file works on `app.pymeshub.lat`, on `*.workers.dev`, and under `wrangler dev`
 * without being regenerated for each.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layers, namedFlavor } from "@protomaps/basemaps";

const OUT = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"apps",
	"web",
	"map",
	"style.json",
);

/**
 * `layers()` stamps `source: "protomaps"` on every layer it emits, so the source
 * key has to be `protomaps` — renaming it here would need a rewrite of 68 layers
 * and is a mismatch waiting to happen. The name is accurate anyway: the tiles are
 * Protomaps-derived, whatever host serves them.
 */
const SOURCE_ID = "protomaps";

/**
 * Flavor is `light`, and `white` is not an equivalent alternative. Measured on
 * `@protomaps/basemaps@5.7.2`: `namedFlavor("light")` yields 71 layers with every
 * paint resolved; `namedFlavor("white")` yields 69 and `landcover` comes back with
 * `paint: undefined`, so that layer renders nothing. `light` is the complete
 * palette.
 */
const FLAVOR = "light";

/**
 * `lang: "es"` — the app's primary locale. It selects the `name:es` / `name:en` /
 * `pgf:name` coalesce order in the label expressions.
 */
const LANG = "es";

/**
 * Full credit, on the source rather than in a layer. This is the "way to access
 * more information, including origin and licence" half of the attribution
 * contract; the always-visible line is drawn by the app from
 * `discovery.map.attribution` ("© OpenStreetMap contributors · ODbL") and is
 * deliberately not in the style.
 *
 * ODbL §4.3 attaches the credit to the Produced Work, so self-hosting the tiles
 * discharges nothing — the credit travels with anything drawn from them.
 */
const ATTRIBUTION =
	'<a href="https://protomaps.com">Protomaps</a> © ' +
	'<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ' +
	'<a href="https://opendatacommons.org/licenses/odbl/">ODbL</a>';

const style = {
	version: 8,
	name: "PymesHub",
	// Deliberately not an OpenMapTiles style: the archive is a Protomaps build, so
	// the layer and source-layer names below are `earth` / `roads` / `places` /
	// `pois`, not `waterway` / `transportation` / `place`. Anything expecting the
	// other schema will draw nothing and report nothing.
	glyphs: "{BASE}/api/map/glyphs/{fontstack}/{range}.pbf",
	sprite: "{BASE}/api/map/sprite",
	sources: {
		[SOURCE_ID]: {
			// `pmtiles://` is not a MapLibre-spec scheme. MapLibre Native resolves it
			// below the JS bridge (`PMTilesFileSource`); `maplibre-gl` in a browser
			// does not, and needs `maplibregl.addProtocol("pmtiles", …)` registered
			// before the map is constructed. Both consumers must do their half.
			type: "vector",
			url: `pmtiles://{BASE}/api/map/basemap.pmtiles`,
			attribution: ATTRIBUTION,
		},
	},
	layers: layers(SOURCE_ID, namedFlavor(FLAVOR), { lang: LANG }),
	// Defaults only. Both consumers pass their own center and zoom — the mobile
	// band is fixed at `STREET_ZOOM = 14` over the device location, the web page at
	// z7 over Costa Rica.
	center: [-84.0907, 9.9281],
	zoom: 14,
};

writeFileSync(OUT, `${JSON.stringify(style, null, "\t")}\n`, "utf8");

// Fontstack names are the literal strings sitting inside the `text-font`
// expressions. Pulling them out of the serialized document is simpler than
// walking every expression shape they take, and complete.
const fontstacks = new Set();
const raw = JSON.stringify(style);
for (const match of raw.matchAll(/"Noto Sans[^"]*"/g)) {
	fontstacks.add(match[0].slice(1, -1));
}

console.log(`wrote ${OUT}`);
console.log(`  layers:      ${style.layers.length}`);
console.log(`  flavor:      ${FLAVOR}`);
console.log(`  lang:        ${LANG}`);
console.log(`  fontstacks:  ${[...fontstacks].sort().join(", ")}`);
console.log("");
console.log("Font ranges to mirror into R2 under map/glyphs/<stack>/0-255.pbf …:");
for (const stack of [...fontstacks].sort()) console.log(`  ${stack}`);

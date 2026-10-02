/**
 * Resize the sector photographs down to what a 64pt tile can actually draw, in place.
 *
 * ## Why a script and not the admin console
 *
 * `category.image_url` is now writable — `adminCategoryInput` carries it, `saveCategory`
 * persists it, and the console's `CategoryDialog` has a field for it — so an operator *can*
 * upload one photo at a time through the UI. That is the right tool when a photo changes.
 * It is the wrong tool for the first pass, which is eighteen files that all need the same
 * treatment, and `MAX_UPLOAD_BYTES` is 4 MiB while a 2k PNG is routinely twice that.
 *
 * So this reduces them before anything tries to serve or upload them, and reports what it
 * did rather than deciding silently. It never touches the database.
 *
 * ## What it guarantees
 *
 * - **Square.** `category-rail.tsx` draws the photo with `resizeMode="cover"` (the
 *   `./image` default) at `width: 100%, height: 100%` on a 64pt box. A non-square master is
 *   cropped on both sides to fit, and a cutout loses its edges. `fit: "cover"` here means
 *   the stored file is already the shape the tile wants.
 * - **Small.** 512px is 8x the 64pt tile at the emulator's 3.0x density, which covers a 2x
 *   device with headroom for the 1.04 selected-scale transform, and lands far under the
 *   4 MiB ceiling.
 * - **WebP, not PNG.** A photographic subject in PNG is several times the bytes of the same
 *   image in WebP for no visible gain on a 64pt tile — the three real files came out at
 *   2169 KB, 1234 KB and 2153 KB as PNG and 43, 28 and 76 KB as WebP. `uploads.create`
 *   accepts WebP (`UPLOAD_MIME_TYPES` is jpeg/png/webp).
 *
 * ## Why it writes in place
 *
 * The files are generated artwork the operator will re-generate occasionally, and git
 * already tracks every other asset in the repo. Writing beside the source keeps the mapping
 * obvious: `food-beverage.png` next to `food-beverage.webp`.
 *
 * ## Usage
 *
 *     node scripts/category-images.mjs [--in <dir>] [--size <px>] [--dry]
 *
 * `--dry` prints the table and writes nothing, which is the default worth running first.
 */

import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import sharp from "sharp";

/** Where the generated masters land, and where the derivatives go. */
const DEFAULT_IN = "apps/mobile/assets/categories";
const DEFAULT_SIZE = 512;

/**
 * Parse `--in`, `--size` and `--dry` by hand rather than reaching for a parser.
 *
 * The repo has no CLI-argument dependency and one does not justify adding for three flags.
 */
function parseArgs(argv) {
	const out = { in: DEFAULT_IN, size: DEFAULT_SIZE, dry: false };
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--in") out.in = argv[(i += 1)];
		else if (arg === "--size") out.size = Number.parseInt(argv[(i += 1)], 10);
		else if (arg === "--dry") out.dry = true;
		else throw new Error(`unknown flag: ${arg}`);
	}
	if (!Number.isInteger(out.size) || out.size < 64) {
		throw new Error(`--size must be an integer >= 64, got ${args.size}`);
	}
	return out;
}

/** Raster masters we accept. Vector input would need a different pipeline entirely. */
const RASTER = new Set([".png", ".jpg", ".jpeg"]);

const bytes = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
	const args = parseArgs(process.argv.slice(2));

	let entries;
	try {
		entries = await readdir(args.in);
	} catch (cause) {
		if (cause.code === "ENOENT") {
			console.log(
				`  nothing to do: ${args.in} does not exist.\n` +
					`  Drop the generated masters there first — see the prompt list in the plan.`,
			);
			return;
		}
		throw cause;
	}

	// `.webp` is excluded so a second run cannot re-encode its own output, and `.tmp` so a
	// run interrupted mid-write does not pick up a half-written staging file.
	const sources = entries
		.filter((name) => RASTER.has(extname(name).toLowerCase()))
		.sort();

	if (sources.length === 0) {
		console.log(`  no .png/.jpg masters in ${args.in}`);
		return;
	}

	console.log(
		`  ${args.dry ? "would write" : "writing"} ${sources.length} file(s) at ${args.size}px square\n`,
	);
	console.log(`  ${"master".padEnd(46)} ${"pixels".padStart(11)} ${"before".padStart(9)}  ${"after".padStart(9)}`);
	console.log(`  ${"-".repeat(46)} ${"-".repeat(11)} ${"-".repeat(9)}  ${"-".repeat(9)}`);

	let written = 0;
	const skipped = [];

	for (const name of sources) {
		const src = join(args.in, name);
		const out = join(args.in, `${basename(name, extname(name))}.webp`);
		// `sharp` infers the output format from the extension, so it cannot target `.webp`
		// through a staging name ending in `.tmp`. The staging file is removed on every path
		// below; leaving one behind would put a duplicate of every derivative into git and
		// into the app bundle.
		const tmp = `${out}.tmp`;

		// `stat`, not `sharp(...).metadata().size` — the metadata object carries the pixel
		// dimensions and the format, and **not** the file's byte size, so the "before"
		// column was printing 0 KB for every master and the encode-grew-the-file check below
		// was comparing against nothing.
		const before = (await stat(src)).size;
		const meta = await sharp(src).metadata();

		// A square source is scaled as-is. A non-square one is cropped to the centre square
		// rather than stretched, because `resizeMode="cover"` on the tile would do exactly
		// that to a non-square file, and the two must not disagree about what is visible.
		const info = await sharp(src)
			.resize(args.size, args.size, {
				fit: "cover",
				position: "centre",
				withoutEnlargement: true,
			})
			.toFormat("webp")
			.toFile(tmp);

		if (before > 0 && info.size >= before) {
			// Encoding made it bigger. That is the signal this asset is not photographic —
			// a flat diagram, a logo, a line drawing — and WebP is the wrong container.
			await rm(tmp, { force: true });
			skipped.push(`${name} — webp was not smaller than the source; left alone`);
			continue;
		}

		// The source dimensions, because a master that is already square and already small
		// needs no work and the operator should be able to see that without opening it.
		const source = meta.width && meta.height ? `${meta.width}x${meta.height}` : "?";

		console.log(
			`  ${name.padEnd(46)} ${source.padStart(11)} ${bytes(before).padStart(9)}  ${bytes(info.size).padStart(9)}`,
		);

		if (args.dry) {
			await rm(tmp, { force: true });
			continue;
		}

		await writeFile(out, await readFile(tmp));
		await rm(tmp, { force: true });
		written += 1;
	}

	console.log();
	if (args.dry) {
		console.log(`  dry run — nothing written. Drop --dry to write.`);
	} else {
		console.log(`  ${written} derivative(s) written as .webp beside the masters`);
	}
	for (const note of skipped) console.log(`  skipped: ${note}`);
}

await main();
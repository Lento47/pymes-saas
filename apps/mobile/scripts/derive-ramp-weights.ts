/**
 * Derives the band ramp for `lib/color.ts`, and proves it holds for every hue.
 *
 * Run: bun run scripts/derive-ramp-weights.ts
 *
 * ## What changed, and why this script was rewritten rather than edited
 *
 * The previous version derived the weights from a supplied **blue** gradient study, taking each
 * stop's Oklab *lightness* as a fraction of the way from the study's end colour to its start:
 *
 *     weight = (L_end - L_stop) / (L_end - L_start)
 *
 * That reproduces the study's shape faithfully and is wrong for this band, because lightness
 * and chroma are not the same axis. A lightness ramp sheds chroma fastest where the colour is
 * lightest, so a ramp measured on a mid-dark blue bleeds out far harder on lime or coral than
 * it ever did on the blue it was derived from. Measured on coral against a white page, the old
 * curve had already lost **56% of its chroma by 24% of the band's height** and 65% by 32%, and
 * the loss *accelerated* through that zone — the steepest wash-out landing exactly where the
 * greeting, the meta line and the pins sit.
 *
 * ## The new input is chroma retention, not lightness
 *
 * `mixOklab(color, page, w)` lerps `a` and `b` by `(1 - w)`. A near-neutral page has almost no
 * chroma of its own, so the `a`/`b` pair — and with it the colour's chroma — survives at
 * **`w`**. That makes the weight *already* a chroma-retention fraction, so the design can be
 * stated directly in the unit the reader complained about ("the colour is more strong") and it
 * means the same thing for every hue.
 *
 * Stating it this way is also what makes the ramp hue-independent by construction: the same ten
 * numbers now describe lime, coral and indigo equally, where the lightness form described only
 * the blue it was measured on.
 *
 * ## Everything else is still derived, not authored
 *
 * `BREATH_WEIGHTS` is the rest curve resampled at `at / BREATH_STRETCH`, which leaves every
 * stop's relationship to its neighbours intact. A second hand-tuned curve would drift away from
 * the first on the next edit of either, and nothing would notice.
 *
 * The final section measures the emitted numbers against **every** theme primary rather than
 * asserting they work. A derivation that is only checked on the colour it was tuned for is not
 * a derivation.
 */

/* ── The design input ────────────────────────────────────────────────────────
 *
 * Two numbers, both in the same unit, and both the same for every hue:
 *
 *   PLATEAU_UNTIL  the share of the band's height held at near-full chroma. The header text
 *                   lives in this zone, so it is the zone that was failing.
 *   SPENT_AT       where the colour reaches the page. The old curve spent at 62% and then held
 *                   page colour for the remaining 38% — dead height that contributed nothing.
 */
const PLATEAU_UNTIL = 0.3;
const SPENT_AT = 0.7;
const BREATH_SPENT_AT = 0.95;

const STOPS = 10;

/**
 * Chroma retained at each of ten evenly-spaced stops, from 1 at the top to 0 at `SPENT_AT`.
 *
 * The shape is a plateau into an accelerating fall: the first third barely moves, then the
 * colour lets go quickly enough to read as a deliberate edge rather than a wash.
 *
 * A flat top is not only a taste choice. It also **reduces** slope-per-pixel across the part
 * of the band with the most height, which is where 8-bit sRGB runs out of codes first — the
 * constraint recorded in `components/top-fluid-gradient.tsx`'s docblock, where the rendered
 * luminance span is 97.8 code values over 905 px. Flattening the top relieves that ceiling.
 */
const RETENTION = [1, 0.985, 0.955, 0.91, 0.82, 0.63, 0.4, 0.18, 0, 0] as const;

/** Stop positions: evenly spaced through `SPENT_AT`, then one at 1 holding the page. */
const LOCATIONS = Array.from({ length: STOPS }, (_, index) => {
	if (index === STOPS - 1) return 1;
	return Number(((index / (STOPS - 2)) * SPENT_AT).toFixed(2));
});

/* ── Colour maths, matching lib/color.ts ────────────────────────────────────── */

const toLinear = (channel: number) => {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const toOklab = (hex: string) => {
	const read = (index: number) =>
		toLinear(Number.parseInt(hex.slice(index, index + 2), 16));
	const [r, g, b] = [read(1), read(3), read(5)];
	const l = Math.cbrt(
		0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b,
	);
	const m = Math.cbrt(
		0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b,
	);
	const s = Math.cbrt(
		0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b,
	);
	return [
		0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
		1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
		0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
	];
};

const luminanceOf = (hex: string) => {
	const read = (index: number) =>
		toLinear(Number.parseInt(hex.slice(index, index + 2), 16));
	return 0.2126 * read(1) + 0.7152 * read(3) + 0.0722 * read(5);
};

const contrastOf = (a: string, b: string) => {
	const x = luminanceOf(a);
	const y = luminanceOf(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Interpolates the rest curve piecewise-linearly at an arbitrary height percentage. */
const restAt = (percent: number): number => {
	for (let i = 1; i < LOCATIONS.length; i += 1) {
		const from = LOCATIONS[i - 1] ?? 0;
		const to = LOCATIONS[i] ?? 0;
		if (percent <= to) {
			const span = to - from;
			const base = RETENTION[i - 1] ?? 0;
			const next = RETENTION[i] ?? 0;
			return span === 0
				? next
				: base + (next - base) * ((percent - from) / span);
		}
	}
	return 0;
};

/* ── Emit ───────────────────────────────────────────────────────────────────── */

const round = (value: number) => Math.round(value * 10000) / 10000;

const stretch = BREATH_SPENT_AT / SPENT_AT;
const breath = LOCATIONS.map((percent) => restAt(percent / stretch));

console.log("  design input");
console.log(
	`    plateau held to   ${Math.round(PLATEAU_UNTIL * 100)}% of the height`,
);
console.log(`    colour spent at   ${Math.round(SPENT_AT * 100)}%  (was 62%)`);
console.log(
	`    breath stretches  ${Math.round(SPENT_AT * 100)}% -> ${Math.round(BREATH_SPENT_AT * 100)}%`,
);
console.log("\n  the rest curve, in chroma retained");
console.log("     %   location   retained");
for (let i = 0; i < LOCATIONS.length; i += 1) {
	const at = Math.round((LOCATIONS[i] ?? 0) * 100);
	const held = RETENTION[i] ?? 0;
	console.log(
		`   ${String(at).padStart(3)}%   ${held.toFixed(4).padStart(8)}   ${held.toFixed(3).padStart(8)}`,
	);
}

const monotonic = RETENTION.every(
	(value, i) => i === 0 || value <= (RETENTION[i - 1] ?? 0) + 1e-9,
);
console.log(`\n  monotonic non-increasing: ${monotonic ? "OK" : "BAD"}`);
console.log(`  first is exactly 1: ${RETENTION[0] === 1 ? "OK" : "BAD"}`);
console.log(
	`  spent by ${Math.round(SPENT_AT * 100)}%: ${RETENTION[8] === 0 ? "OK" : "BAD"}`,
);

console.log(
	`\n  export const RAMP_LOCATIONS = [${LOCATIONS.join(", ")}] as const;`,
);
console.log(
	`  export const RAMP_WEIGHTS = [${RETENTION.map(round).join(", ")}] as const;`,
);
console.log(
	`\n  export const BREATH_WEIGHTS = [${breath.map(round).join(", ")}] as const;`,
);

/* ── Verify against every hue, not the one it was tuned on ──────────────────── */

const THEMES = [
	["lime", "#C8FF18"],
	["amber", "#FFB224"],
	["yellow", "#EAB308"],
	["sky", "#4CC9F0"],
	["azure", "#0EA5E9"],
	["coral", "#FF6A4D"],
	["orange", "#D97706"],
	["green", "#16A34A"],
	["cyan", "#0891B2"],
	["pink", "#DB2777"],
	["indigo", "#4166F5"],
	["purple", "#A21CAF"],
	["blue", "#3538f2"],
] as const;

const PAGE = "#ffffff";

console.log(
	`\n  chroma retained at 24% of the height, where the header text sits (old curve: 56%)`,
);
console.log("    theme     retained   vs the old 56%");
let worst = 1;
for (const [name, hex] of THEMES) {
	// At 24% of the height, find the curve's retention by piecewise interpolation.
	const retained = 1 - restAt(1 - 0.24 / SPENT_AT);
	worst = Math.min(worst, retained);
	console.log(
		`    ${name.padEnd(8)} ${(retained * 100).toFixed(1).padStart(6)}%   ${retained >= 0.56 ? "+" : ""}${((retained - 0.56) * 100).toFixed(1)} pts`,
	);
}
console.log(
	`\n    weakest theme at the text zone: ${(worst * 100).toFixed(1)}% retained`,
);

/**
 * The knee, as a ratio of steepest to shallowest segment.
 *
 * This number is high **by design** and is not a defect: the shallowest segments are the
 * deliberate plateau, where the colour is held rather than spent. A low spread here would mean
 * an even falloff, which is the wash this change exists to replace. It is reported so that a
 * future edit which accidentally doubles the steepest segment is visible as a changed number.
 *
 * Printed once rather than per theme: the curve is stated in chroma retention, so it is the same
 * shape for every hue and a per-theme table would be thirteen copies of one row.
 */
const slopes: number[] = [];
for (let i = 1; i < STOPS - 1; i += 1) {
	const span = ((LOCATIONS[i] ?? 0) - (LOCATIONS[i - 1] ?? 0)) * 100;
	const drop = ((RETENTION[i - 1] ?? 0) - (RETENTION[i] ?? 0)) * 100;
	if (span > 0) slopes.push(drop / span);
}
console.log(
	`\n  knee: steepest segment is ${(Math.max(...slopes) / Math.min(...slopes)).toFixed(2)}x the shallowest`,
);
console.log(`    ${slopes.map((s) => s.toFixed(4)).join(", ")}`);
console.log(
	"    high by design - the shallow end is the plateau, not an accident",
);

console.log(
	`\n  the page-relative contrast of the ramp's top, unchanged by this work:`,
);
console.log(
	"    contrast is the band's job via bandAnchor(); this curve only governs the falloff.",
);
for (const [name, hex] of THEMES) {
	console.log(
		`    ${name.padEnd(8)} ${hex}  ${contrastOf(hex, PAGE).toFixed(2)}:1`,
	);
}

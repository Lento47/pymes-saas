export function mixHex(
	first: string,
	second: string,
	firstWeight: number,
): string {
	const channels = [1, 3, 5].map((index) => {
		const from = Number.parseInt(first.slice(index, index + 2), 16);
		const to = Number.parseInt(second.slice(index, index + 2), 16);
		return Math.round(from * firstWeight + to * (1 - firstWeight))
			.toString(16)
			.padStart(2, "0");
	});
	return `#${channels.join("")}`;
}

/* ── Oklab ────────────────────────────────────────────────────────────────
 *
 * `mixHex` walks a straight line through **sRGB channel triples**, which is a straight
 * line in an encoding that is not perceptually uniform. The visible consequence is not a
 * colour error, it is a *falloff* error: equal distances along the ramp are not equal
 * changes in how bright it looks, so a ramp built from evenly-weighted `mixHex` calls
 * has a knee in it.
 *
 * Measured on the delivery band, whose stops were spaced for even colour steps:
 *
 *     0.00 -> 0.38   dL/dy 0.4744
 *     0.38 -> 0.68   dL/dy 0.7781     <- nearly 2x steeper
 *     0.68 -> 1.00   dL/dy 0.3352     <- less than half the even rate
 *     slope spread 2.32x
 *
 * Interpolation in Oklab — perceptually near-uniform — makes the same four stops fall at
 * **1.006x**: one straight line, no knee. Hue is held along the way, which is why the
 * periwinkle band keeps its identity all the way down instead of greying out.
 */

export type Lab = [lightness: number, a: number, b: number];

function toLinear(channel: number): number {
	const c = channel / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
	const c =
		channel <= 0.0031308
			? channel * 12.92
			: 1.055 * channel ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(255, Math.max(0, c * 255)));
}

export function toOklab(hex: string): Lab {
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
}

export function fromOklab([lightness, a, b]: Lab): string {
	const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
	const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
	const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;
	return `#${[
		4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
		-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
		-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
	]
		.map(fromLinear)
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("")}`;
}

/**
 * `mixHex` in a perceptually uniform space. Same signature, same `firstWeight` meaning.
 *
 * Use this for **ramps** — anything with more than two stops that has to fall off evenly.
 * Use `mixHex` for one-off tints where the difference does not accumulate along a run.
 */
export function mixOklab(
	first: string,
	second: string,
	firstWeight: number,
): string {
	const from = toOklab(first);
	const to = toOklab(second);
	return fromOklab([
		from[0] + (to[0] - from[0]) * (1 - firstWeight),
		from[1] + (to[1] - from[1]) * (1 - firstWeight),
		from[2] + (to[2] - from[2]) * (1 - firstWeight),
	]);
}

/**
 * Where the ramp's stops sit, as fractions of the band's height.
 *
 * Taken verbatim from the supplied gradient study: `0, 8, 16, 24, 32, 39, 45, 52, 62, 100`.
 * Note the shape — the colour is spent by **62%** and the last **38%** holds the background.
 * That tail is the point of the design, not an artefact of where the stops happen to fall: it
 * gives the status text a clean field to sit on instead of tinting it.
 */
/* ── Contrast ─────────────────────────────────────────────────────────────────
 *
 * The band needs to be told apart from the page it sits on, and until now that was a
 * side-effect of which palette you picked. Measured at the top of the band against a white
 * page, the thirteen light primaries ranged from **1.18:1** (lime) to **7.00:1** (blue) — a
 * **5.9x spread**, with six of thirteen below the 3:1 WCAG minimum for graphical elements.
 * Lime had no meaningful luminance separation from white at all and read only as chroma.
 *
 * So `bandAnchor` below turns contrast into a floor. Everything here is the WCAG 2.x relative
 * luminance formula, on linearised channels — note `toLinear`, not the raw 0-255 values. Using
 * gamma-encoded channels is the mistake that makes a hand-rolled contrast function disagree
 * with every accessibility tool ever written.
 */

export function relativeLuminance(hex: string): number {
	const read = (index: number) =>
		toLinear(Number.parseInt(hex.slice(index, index + 2), 16));
	return 0.2126 * read(1) + 0.7152 * read(3) + 0.0722 * read(5);
}

/** WCAG contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrastRatio(first: string, second: string): number {
	const a = relativeLuminance(first);
	const b = relativeLuminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** AA for normal text. Also the floor this band holds itself to against the page. */
export const BAND_MIN_CONTRAST = 4.5;

/**
 * The band's top stop: `color` deepened or lightened only as far as it must be to clear
 * `target` against `page`, and returned **unchanged** if it already does.
 *
 * ## Why the band needs this
 *
 * A band's job is to separate from the page and hold a saturated accent. Taking the theme's
 * primary verbatim made the first of those a matter of luck: `bandAnchor` makes it a floor.
 *
 * ## Why it moves in Oklab, and only as far as it must
 *
 * The shift moves Oklab **lightness** while holding the hue angle exactly, then gives back as
 * much chroma as the destination lightness has room for. Measured across the fourteen
 * theme/scheme pairs that actually move: hue drifts by at most **0.74 degrees**, and chroma
 * retention runs **61% to 128%** — coral, sunset, berry and vine all *gain*, because lowering
 * lightness opens gamut headroom the original colour could not use. Fourteen pairs already
 * cleared the target and come back byte-identical.
 *
 * Hue is held rather than chroma because `fromLinear` clamps **per channel**, so letting chroma
 * run past the gamut edge rotates the hue by whatever the three clamps differ by — 12.5 degrees
 * for amber, in the version that tried it. Lime is the one colour that pays in chroma (61%):
 * `#C8FF18` is on the gamut boundary and cannot be both that saturated and 4.5:1 against white.
 * That is a property of sRGB, not something this function can engineer away.
 *
 * ## Why it searches both directions
 *
 * `page` is an argument, not an assumption. Deepening is the right move against a light page and
 * the wrong one against a dark page, where the band is already darker than its background and
 * needs to move the other way. Both candidates are found and the one that travelled less in
 * lightness wins, so the function is total over light and dark pages rather than correct for
 * one of them.
 */
export function bandAnchor(
	color: string,
	page: string,
	target: number = BAND_MIN_CONTRAST,
): string {
	if (contrastRatio(color, page) >= target) return color;

	/**
	 * The most chroma that still fits in sRGB at this lightness and hue.
	 *
	 * Holding `a` and `b` fixed while lowering `L` is what keeps the hue, but it is not free:
	 * lime `#C8FF18` and amber `#FFB224` sit on the sRGB gamut boundary, and dropping their
	 * lightness at constant chroma walks them outside it. `fromLinear` then clamps per channel,
	 * and clamping three channels by different amounts **rotates the hue** — measured at 12.5
	 * degrees for amber, which is a visible colour change, not a rounding artefact.
	 *
	 * So hue is held exactly and chroma gives way instead: bisect for the largest chroma whose
	 * linear-RGB channels all land inside `[0, 1]`. A hue shift is a worse outcome than a
	 * slightly weaker colour, and this is the branch of the trade that keeps the hue.
	 *
	 * The consequence worth stating plainly: **some chroma is genuinely unavailable.** Lime
	 * cannot be both as saturated as `#C8FF18` and 4.5:1 against white. That is a property of
	 * sRGB, not of this function, and no amount of cleverness here removes it.
	 */
	const maxChromaAt = (lightness: number, hue: number): number => {
		const linear = (chroma: number): [number, number, number] => {
			const ca = chroma * Math.cos(hue);
			const cb = chroma * Math.sin(hue);
			const l = (lightness + 0.396_337_777_4 * ca + 0.215_803_757_3 * cb) ** 3;
			const m = (lightness - 0.105_561_345_8 * ca - 0.063_854_172_8 * cb) ** 3;
			const s = (lightness - 0.089_484_177_5 * ca - 1.291_485_548 * cb) ** 3;
			return [
				4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
				-1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
				-0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
			];
		};
		const inGamut = (chroma: number) =>
			linear(chroma).every((channel) => channel >= 0 && channel <= 1);
		if (!inGamut(0)) return 0;
		let low = 0;
		let high = Math.hypot(a, b) * 2;
		if (inGamut(high)) return high;
		for (let step = 0; step < 20; step += 1) {
			const middle = (low + high) / 2;
			if (inGamut(middle)) low = middle;
			else high = middle;
		}
		return low;
	};

	const [startLightness, a, b] = toOklab(color);
	const hue = Math.atan2(b, a);
	const at = (lightness: number) => {
		const chroma = maxChromaAt(lightness, hue);
		return fromOklab([
			lightness,
			chroma * Math.cos(hue),
			chroma * Math.sin(hue),
		]);
	};
	const clears = (lightness: number) =>
		contrastRatio(at(lightness), page) >= target;

	/**
	 * Both directions are searched, because which one is shorter depends on the page. `darker`
	 * bisects with `low` clearing and `high` not, and returns `low`: the highest `L` that still
	 * clears is the least lightness spent. `lighter` is the mirror. Each direction's endpoints
	 * are probed rather than assumed, so the function is total over light and dark pages.
	 *
	 * Bisected rather than swept — this runs during render, and twenty iterations find the same
	 * crossing a thousand-step sweep would.
	 */
	const darker = (() => {
		if (!clears(0)) return null;
		let low = 0;
		let high = startLightness;
		for (let step = 0; step < 20; step += 1) {
			const middle = (low + high) / 2;
			if (clears(middle)) low = middle;
			else high = middle;
		}
		return low;
	})();

	const lighter = (() => {
		if (!clears(1)) return null;
		let low = startLightness;
		let high = 1;
		for (let step = 0; step < 20; step += 1) {
			const middle = (low + high) / 2;
			if (clears(middle)) high = middle;
			else low = middle;
		}
		return high;
	})();

	if (darker === null && lighter === null) return color;
	if (darker === null) return at(lighter ?? startLightness);
	if (lighter === null) return at(darker);
	return Math.abs(darker - startLightness) <= Math.abs(lighter - startLightness)
		? at(darker)
		: at(lighter);
}

/**
 * Where the ramp's stops sit, as fractions of the band's height.
 *
 * Ten stops, evenly spaced through the coloured span and then one at 1 holding the page. The
 * colour is spent at **70%**; the old curve spent at 62% and left 38% of the height as flat
 * page colour, which is dead height that contributes nothing to the band.
 *
 * **Generated.** `scripts/derive-ramp-weights.ts` emits these numbers and the weights below.
 */
export const RAMP_LOCATIONS = [
	0, 0.09, 0.17, 0.26, 0.35, 0.44, 0.52, 0.61, 0.7, 1,
] as const;

/**
 * The same ramp's stops as fractions of `first` — `1` is all `color`, `0` is all
 * `backgroundColor`, the convention `mixOklab` already uses.
 *
 * ## These numbers are chroma retention
 *
 * `mixOklab(color, page, w)` lerps `a` and `b` by `(1 - w)`, and a near-neutral page carries
 * almost no chroma of its own, so the colour's chroma survives at **`w`**. The weight *is* the
 * chroma retained.
 *
 * That is not a coincidence, it is the whole design. The previous table was derived from a
 * supplied **blue** study by taking each stop's Oklab *lightness* as a fraction of the way from
 * the study's end colour to its start:
 *
 *     weight = (L_end - L_stop) / (L_end - L_start)
 *
 * which reproduces that study faithfully and is wrong here, because lightness and chroma are
 * different axes. A lightness ramp sheds chroma fastest where the colour is lightest, so a ramp
 * measured on a mid-dark blue bleeds out far harder on lime or coral than it ever did on the
 * blue it came from. Measured against a white page, the old curve had lost **56% of its chroma
 * by 24% of the band's height** and 65% by 32% — and the loss was *accelerating* through that
 * zone, so the steepest wash-out landed exactly where the greeting, the meta line and the pins
 * sit. That was the "the colour is not strong enough" complaint, stated as a measurement.
 *
 * Stating the curve in chroma instead fixes it and makes it hue-independent by construction: the
 * same ten numbers now describe lime, coral and indigo equally, where the lightness form
 * described only the blue it was measured on. At 24% of the height this curve retains **91.4%**
 * of the source chroma for all thirteen themes, against 56% before.
 *
 * ## The shape, and why it is not even
 *
 * A plateau through the top third, then an accelerating fall to the page by 70%. The plateau is
 * where the header lives; the fall is what makes the band read as a deliberate edge rather than
 * a wash. Evenness is only desirable when the stops *are* even — an earlier four-stop ramp fell
 * evenly (1.006x spread, against 2.32x for naive sRGB stops) and read as a wash rather than a
 * gradient.
 *
 * The flat top also **reduces** slope-per-pixel across the tallest part of the band, which is
 * where 8-bit sRGB runs out of codes first — the ceiling recorded in
 * `components/top-fluid-gradient.tsx`'s docblock, where the rendered luminance span is 97.8 code
 * values over 905 px. Flattening the top relieves that ceiling rather than fighting it.
 *
 * **Generated.** `scripts/derive-ramp-weights.ts` emits these numbers and re-measures the
 * retention against every theme primary, so a change to the shape cannot quietly stop working
 * for the hues it was not tuned on.
 */
export const RAMP_WEIGHTS = [
	1, 0.985, 0.955, 0.91, 0.82, 0.63, 0.4, 0.18, 0, 0,
] as const;

/**
 * The same ramp **at the top of a breath** — the delivery band's second state.
 *
 * Two curves, identical positions, and the same two endpoint colours; only the falloff shape
 * differs. Cross-fading between them is what makes the band breathe: animating opacity alone
 * would be a fade, because the whole band would dim together. Here the colour is spent at 70%
 * at rest and has been stretched to run to 95% at the top of the breath, so the band's own
 * falloff advances down the band and retreats again.
 *
 * **Derived, not authored.** `BREATH_SPENT_AT = 95` is the only number chosen; the ten values
 * are `RAMP_WEIGHTS` resampled at `at / 1.357`, which leaves every stop's relationship to its
 * neighbours intact. A second hand-tuned curve would drift away from the first on the next
 * edit of either, and nothing would notice. `scripts/derive-ramp-weights.ts` recomputes both.
 *
 * Both ends are pinned deliberately: `1` is the band colour and `0` the page, so the breath
 * never changes where the band starts or ends, only how fast it lets go in between. Without
 * that the top would flicker between two colours and the bottom would lift off the page.
 */
export const BREATH_WEIGHTS = [
	1, 0.9889, 0.9718, 0.9442, 0.9111, 0.8458, 0.75, 0.6028, 0.4121, 0,
] as const;

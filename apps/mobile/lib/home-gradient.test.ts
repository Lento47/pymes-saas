import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const gradient = readFileSync(
	join(root, "components", "home-gradient.tsx"),
	"utf8",
);
const fluid = readFileSync(
	join(root, "components", "top-fluid-gradient.tsx"),
	"utf8",
);
const screen = readFileSync(join(root, "components", "screen.tsx"), "utf8");
const purchaseColors = readFileSync(
	join(root, "lib", "purchase-colors.ts"),
	"utf8",
);
const home = readFileSync(
	join(root, "app", "(customer)", "(tabs)", "index.tsx"),
	"utf8",
);
const header = readFileSync(
	join(root, "components", "home-header.tsx"),
	"utf8",
);

/**
 * Two things are asserted here, and the second is the one that matters.
 *
 * **What lime-dark draws**, which changed: it is now lime at the top rather than an olive, so
 * the band reads as lime against black rather than a green haze — the "apagado" complaint. It
 * also ends sooner, because it is the only *opaque* ramp in the file and an opaque ramp has an
 * edge to land under a card.
 *
 * **What light still draws**, which must not change except the height the sheet needs, and is
 * held here as literals rather than left to review. A refactor that recolours the ramp, moves
 * a stop, or reaches the light branch by accident fails here instead of shipping.
 */
describe("home gradient", () => {
	test("light keeps its own ramp, locations and band, byte for byte", () => {
		expect(gradient).toContain(
			'LIME_LIGHT = ["#C8FF18", "#A9DE00", "#E2F4AC", "#FFFFFF"]',
		);
		expect(gradient).toContain("LOCATIONS = [0, 18 / 52, 35 / 52, 1] as const");
		expect(gradient).toContain("const BAND = 0.34");
	});

	test("the dark band is keyed on lime-and-dark, not on scheme alone", () => {
		// The blast radius of every number below. `scheme === "dark"` on its own would move
		// the other twelve dark palettes, which nobody asked for; `isLime &&` is what keeps
		// this to the one combination that was wrong.
		expect(gradient).toContain('const darkLime = isLime && scheme === "dark";');
		expect(gradient).toContain("Boolean(journeyBand) || darkLime");
		expect(gradient).toContain("const COMPACT_BAND = 0.16");
		expect(gradient).toContain("const COMPACT_LOCATIONS = [0, 0.54, 0.72, 1]");
		expect(gradient).toContain("DARK_LIME_BAND");
		expect(gradient).toContain(": LOCATIONS");
	});

	test("dark opens on lime and ends on the theme's own background", () => {
		expect(gradient).toContain(
			'LIME_DARK = ["#C8FF18", "#A9DE00", "#3A3A18", "#0F0F0F"]',
		);
		expect(gradient).toContain(
			"DARK_LIME_LOCATIONS = [0, 0.5, 0.72, 1] as const",
		);
		expect(gradient).toContain("const DARK_LIME_BAND = 0.34");
		// The last stop has to BE the dark background, or the band ends on a seam. This is
		// `lime.dark.background` in `theme/tokens.ts`.
		expect(gradient).toContain('"#0F0F0F"]');
	});

	test("every other theme keeps its alpha ramp, dark and light alike", () => {
		expect(gradient).toContain("withAlpha(color, strengths[0])");
		expect(gradient).toContain("withAlpha(color, strengths[3])");
		// The four alphas have one home — `BROWSING_RAMP_ALPHA` in `./purchase-colors` — because
		// the header measures its ink against the stop the first one composites to. Pinned there,
		// and pinned that this file reads them rather than re-typing the numbers, so a change
		// cannot move the ramp without moving the ink that goes on it.
		expect(purchaseColors).toContain("light: [0.8, 0.6, 0.16, 0]");
		expect(purchaseColors).toContain("dark: [0.42, 0.24, 0.04, 0]");
		expect(purchaseColors).toContain("export const BROWSING_RAMP_ALPHA = {");
		expect(gradient).toContain(
			"const strengths = BROWSING_RAMP_ALPHA[scheme];",
		);
		expect(screen).toContain("backgroundColor: colors.background");
	});
});

describe("header ink on the band", () => {
	test("browsing ink is measured against the stop the ramp draws, on every theme", () => {
		// Three wrong versions of this, each recorded because each looked right.
		//
		// 1. `scheme === "dark" ? primaryForeground : secondaryForeground` — keyed off the scheme
		//    rather than the band under the ink.
		// 2. `purchaseBand("browsing", …).ink` — one source for band and ink, on the reasoning
		//    that it could not disagree with itself. It could: `purchaseBand` *anchors* its colour
		//    with `bandAnchor`, while the browsing ramp draws the primary. The ink was chosen
		//    against the anchor's `#638000` and painted on `#C8FF18`: **1.18:1**.
		// 3. Measuring against `colors.primary`, gated on `onLimeGradient` — right for lime and
		//    **applied to lime alone**. On the other twelve themes nothing was measured at all, so
		//    the meta line kept its own `mutedForeground` over the band: **1.09:1 to 4.28:1**
		//    across the twelve, against the 4.5 a 13px line owes. That gate was the defect.
		//
		// The rule that holds is per-owner, and total: whichever function owns the colour measures
		// the ink against it, on every theme. `browsingBandTop` reproduces the browsing ramp's top
		// stop from the same `BROWSING_RAMP_ALPHA` `./home-gradient` draws with; the journey stages
		// get their colour *and* their ink from `purchaseBand`, which anchors both together.
		// **The header no longer names lime at all**, and that is the correction: the lime branch
		// is what the third wrong version was made of. `./home-gradient` still keys its
		// hand-authored ramps on `isLime` (they are the two opaque ones); `./home-header` reads a
		// measurement, so there is nothing left there for a theme to fall outside of.
		expect(header).not.toMatch(/=== "#c8ff18"/);
		expect(header).not.toMatch(/const onLimeGradient/);
		expect(header).not.toMatch(/t\("home\.brand/);
		expect(header).not.toContain("inkOnBand");
		expect(header).not.toContain("browsingBandTop");
		expect(header).toContain("color={colors.foreground}");
		expect(purchaseColors).toContain("export function browsingBandTop(");
		expect(gradient).toContain("BROWSING_RAMP_ALPHA");
		expect(gradient).toContain('LIME_LIGHT = ["#C8FF18"');
		expect(gradient).toContain('LIME_DARK = ["#C8FF18"');
	});

	test("the home identity is the greeting, not a split wordmark", () => {
		expect(header).toContain('t("home.greeting"');
		expect(header).toContain('t("home.greeting.anon")');
		expect(header).toContain("onNotificationsPress");
		expect(header).toContain('name="notifications-outline"');
		expect(header).toContain('name="location"');
	});
});

describe("the feed's status bar", () => {
	test("lime-dark gets a dark status bar, scoped to this screen", () => {
		// White glyphs on `#C8FF18` are 1.08:1. The root layout's global `onLightCanvas`
		// cannot answer this: it would hand dark glyphs to every other screen in the theme,
		// and every one of those is `#0F0F0F` at the top.
		// Matched as a pattern, not a literal: the formatter wraps this assignment across two
		// lines, and a test that pins the wrap fails on a formatting change while saying
		// nothing about the value. The three terms are what matter.
		expect(screen).toContain("<StatusBar");
		expect(screen).toContain("statusBarStyleForInk(band.ink)");
		expect(home).not.toContain("<StatusBar");
	});

	/**
	 * Every journey band shares one composition: the ten stops of the supplied gradient study.
	 *
	 * The shape is shared and the channel is not. On `delivery` the study's weights drive
	 * **lightness**, through `mixOklab` in `./top-fluid-gradient`, and the band ends on the page
	 * background. On the other journey stages the same weights drive **alpha**, and the band
	 * dissolves to nothing. Both map the same numbers onto the same positions, which is what
	 * makes the shapes match while the endpoints differ — `1` is the band's full colour and `0`
	 * is the page showing through either way.
	 *
	 * Asserted against the constants rather than the derived `colors`, because `colors` is
	 * assembled inline and a test that pins its formatting says nothing about the values.
	 */
	test("journey bands share the study's composition, driving alpha", () => {
		expect(gradient).toContain("RAMP_WEIGHTS.map((weight) =>");
		expect(gradient).toContain("withAlpha(journeyBand, weight)");
		expect(gradient).toContain("locations={locations}");

		// A journey band takes the study's positions; browsing keeps its own, because the lime
		// ramps are hand-authored four-stop palettes whose geometry is load-bearing.
		expect(gradient).toContain("const locations = journeyBand");
		expect(gradient).toContain("? RAMP_LOCATIONS");

		// Every non-browsing stage gets a band, not just the ones that used to be "smooth".
		for (const stage of [
			"browsing",
			"basket",
			"inCart",
			"checkout",
			"confirmed",
			"paid",
			"delivery",
		]) {
			expect(purchaseColors).toContain(`case "${stage}":`);
		}

		// The old per-stage alpha branches are gone; one expression serves them all.
		expect(gradient).not.toContain("smoothBand ? withAlpha");
		expect(gradient).not.toContain("smoothBand ? 0.18");
		expect(gradient).not.toContain("compact ? 0.05");
	});

	/**
	 * The delivery band is **the gradient study's ramp, breathing.**
	 *
	 * Three tests used to live here, describing a travelling Gaussian packet, a cubic spline
	 * through twelve control points, fifteen oscillators, a stroke and a horizon rule. All of
	 * that was removed rather than tuned further, so all three went with it.
	 *
	 * Two ramps are now stacked, not one: \`RAMP_WEIGHTS\` at rest and \`BREATH_WEIGHTS\` at the
	 * top of an inhale, cross-faded. What animates is the ramp's **falloff shape** - the colour
	 * lets go at 62% of the height at rest and at 100% at the top of the breath - rather than the
	 * band's brightness, which is what a single animated gradient would have done.
	 *
	 * The docblock in \`top-fluid-gradient.tsx\` carries the record of everything tried and
	 * measured against this: a grain tile, flat posterised bands, a 1D ordered dither in SVG,
	 * and a 2D Bayer dither in a GL shader. Each was rejected on a device measurement. The
	 * shader did work - 2x2 px against the gradient's 10 px - and was removed anyway, because a
	 * native dependency and a GPU surface on the home screen is a price no header band earns.
	 *
	 * So the load-bearing claims are: the band is reached on \`delivery\` and top-attached; both
	 * ramps are built by \`lib/color.ts\`'s Oklab mix; and the motion is gated on \`motion\`.
	 *
	 * The negative assertions are the point of the second half. They stop the shader, the
	 * posterised bands and the dither *asset* being reintroduced quietly. A tiled \`Image\` cannot
	 * dither here, because magnification fixes the pattern's scale: a tile stretched across the
	 * band turns a 4x4 Bayer matrix into 135 px blocks.
	 */
	test("the delivery band is the study's ramp, breathing", () => {
		// Reached on delivery, and attached to the top of the screen.
		expect(gradient).toContain('stage === "delivery" && journeyBand');
		expect(gradient).toContain("<TopFluidGradient");
		expect(gradient).toContain("Math.min(height * 0.38, 380)");

		// Two gradients at the study's positions, stacked, filling the band edge to edge.
		expect(fluid).toContain("<LinearGradient");
		expect(fluid).toContain("locations={RAMP_LOCATIONS}");
		expect(fluid).toContain("style={StyleSheet.absoluteFill}");
		expect(fluid).toContain("{ height }");

		// Rest and inhale, both from the Oklab mix rather than by hand.
		expect(fluid).toContain("asStops(RAMP_WEIGHTS, color, backgroundColor)");
		expect(fluid).toContain("asStops(BREATH_WEIGHTS, color, backgroundColor)");
		expect(fluid).toContain("mixOklab(from, to, weight)");

		// The breath: a repeat, reversed so the turn has no hitch, on the overlay's opacity.
		// Opacity is the *mechanism*; the ramp's shape is what the reader sees move.
		expect(fluid).toContain("withRepeat(");
		expect(fluid).toContain("duration: duration.breathHalf");
		expect(fluid).toContain("Easing.bezier(");
		expect(fluid).toContain("EASE_BREATH.x1");
		expect(fluid).toContain("useSharedValue");
		// Reversed rather than restarted: a breath that jumped back to empty would set off
		// with the easing it is leaving with, which reads as a hitch on the turn.
		expect(fluid).toMatch(/withRepeat\([\s\S]*?\n\t\t\ttrue,/);

		// Gated on \`motion\`, and \`still\`/\`reduced\` mount no animation at all
		// rather than a faster one - a band that is on screen has to have its shape either way.
		expect(fluid).toContain('const breathing = motion === "normal"');
		expect(fluid).toContain("if (!breathing) {");
		expect(fluid).toContain("breath.value = 0;");
		expect(fluid).toContain("{breathing ? (");
		expect(fluid).not.toMatch(/requestAnimationFrame/);

		// \`./home-gradient\` is what supplies \`still\` - the band stops when the route is
		// not focused, so a backgrounded screen is not animating a surface nobody can see.
		expect(gradient).toContain('motion={focused ? fluidMotion : "still"}');

		// Nothing that could reintroduce the shader, the posterised bands, the SVG gradient
		// or the dither asset. Every one was built, measured, and removed.
		expect(fluid).not.toContain("expo-gl");
		expect(fluid).not.toContain("GLView");
		expect(fluid).not.toContain("BAND_COUNT");
		// Named in the docblock's record of what was removed, so match the require, not the prose.
		expect(fluid).not.toMatch(/require\(.*dither-grain/);
		expect(fluid).not.toMatch(/^import .*\bImage\b.*from "react-native"/m);
		expect(fluid).not.toMatch(/^import .*from "react-native-svg"/m);
	});
});

describe("the band has no extra geometry", () => {
	test("draws the ramp only, with no well, disc, or SVG form", () => {
		expect(gradient).not.toContain("BandGeometry");
		expect(gradient).not.toContain("react-native-svg");
		expect(gradient).not.toContain("<Svg");
		expect(gradient).toMatch(/band: \{ width: "100%", overflow: "hidden" \}/);
	});
});

describe("paints behind the safe area and home content", () => {
	test("without intercepting touch", () => {
		expect(screen).toContain(
			'<View style={StyleSheet.absoluteFill} pointerEvents="none">',
		);
		expect(screen).toContain("const backdrop = background ?? null");
		expect(screen).not.toContain("<HomeGradient");
		expect(screen).not.toContain("HomeEditorialGeometry");
		expect(screen).not.toContain("BandGeometry");
		expect(home).toContain("purchaseStage={null}");
		expect(home).not.toContain("PurchaseWash");
	});
});

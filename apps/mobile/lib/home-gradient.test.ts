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
const home = readFileSync(join(root, "app", "(customer)", "index.tsx"), "utf8");
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
 * **What light still draws**, which must not change, and is held here as literals rather than
 * left to review. Every earlier version of this file asserted the light ramp as a side effect
 * of testing it; it is now the subject. A refactor that shortened the band, moved a stop, or
 * reached the light branch by accident fails here instead of shipping.
 */
describe("home gradient", () => {
	test("light keeps its own ramp, locations and band, byte for byte", () => {
		expect(gradient).toContain(
			'LIME_LIGHT = ["#C8FF18", "#A9DE00", "#E2F4AC", "#FFFFFF"]',
		);
		expect(gradient).toContain("LOCATIONS = [0, 18 / 52, 35 / 52, 1] as const");
		expect(gradient).toContain("const BAND = 0.52");
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
		expect(gradient).toMatch(
			/scheme === "dark" \? \[0\.42, 0\.24, 0\.04, 0\] : \[0\.8, 0\.6, 0\.16, 0\]/,
		);
		expect(screen).toContain("backgroundColor: colors.background");
	});
});

describe("header ink on the lime band", () => {
	test("ink is measured against the colour actually drawn under it", () => {
		// This spec used to require the opposite, and was wrong. It asserted that browsing ink
		// came from `purchaseBand("browsing", …)`, on the reasoning that one source could not
		// disagree with itself.
		//
		// It could — and did, invisibly. `purchaseBand` *anchors* its colour with `bandAnchor`
		// before choosing ink, but the lime browsing ramps in `./home-gradient` are hand-authored
		// and draw `#C8FF18` at the top regardless. So the ink was chosen against the anchor's
		// `#638000` and painted onto `#C8FF18`: **1.18:1**, white on bright lime. The band and the
		// ink came from one function and still described two different colours.
		//
		// The rule that holds is per-owner: whichever function owns the colour measures the ink
		// against it. Browsing owns `#C8FF18` (`LIME_LIGHT`/`LIME_DARK`), so it measures against
		// `colors.primary`. The journey stages get their colour *and* their ink from
		// `purchaseBand`, which anchors both together.
		expect(header).toContain('colors.primary.toLowerCase() === "#c8ff18"');
		expect(header).toMatch(
			/const bandInk = onLimeGradient\s+\? inkOnBand\(\s+colors\.primary,/,
		);
		// The journey stages keep the anchored source, which is where anchoring applies.
		expect(header).toContain("? purchaseBand(stage, colors, scheme)?.ink");
		// Neither the scheme-keyed branch nor the anchored-browsing mistake may come back.
		expect(header).not.toMatch(
			/const bandInk = onLimeGradient\s*\?\s*scheme ===/,
		);
		expect(header).not.toContain(
			'purchaseBand("browsing", colors, scheme)?.ink',
		);
		// And the band it is measured against is the one `./home-gradient` draws, so the two files
		// cannot drift apart silently again.
		expect(gradient).toContain('LIME_LIGHT = ["#C8FF18"');
		expect(gradient).toContain('LIME_DARK = ["#C8FF18"');
	});

	test("the nested location label takes dark-only ink, so light is untouched", () => {
		// These cannot read `bandInk`: they carry a `tone` that light resolves to `#111111`, so
		// `bandInk` would repaint them with the band's ink instead of their own. `limeDarkInk` is
		// `undefined` in light, so no style is attached and the element is byte-identical to what
		// it was.
		expect(header).toContain("limeDarkInk");
		expect(header).toMatch(
			/const limeDarkInk =\s+onLimeGradient && scheme === "dark"/,
		);
		expect(header).toContain("const nestedInk = journeyInk ?? limeDarkInk");
		expect(
			header.match(/nestedInk \? \{ color: nestedInk \} : undefined/g),
		).toHaveLength(1);
	});

	test("the pin keeps light on `foreground` and only dark moves", () => {
		expect(header).toContain("journeyInk ??");
		expect(header).toMatch(/onLimeGradient\s+\? scheme === "light"/);
	});

	test("the greeting is coloured from the band rather than left at the default", () => {
		// It carried no colour at all and took `foreground` — white — which is 1.08:1 on lime.
		expect(header).toContain("const activeInk = journeyInk ?? bandInk");
		expect(header).toContain(
			"style={[styles.title, activeInk ? { color: activeInk } : null]}",
		);
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

describe("the band has a shape, not only a falloff", () => {
	test("the forms are drawn, and clipped by the band rather than over it", () => {
		// Everything the band drew before was one-dimensional. `./home-gradient` pinned its
		// gradient to a vertical axis and `./top-fluid-gradient` passed no `start`/`end` at all, so
		// both defaulted to top-to-bottom, and `expo-linear-gradient` has no radial mode — a curve
		// was not expressible at any alpha or weighting.
		//
		// `overflow: "hidden"` on the band is the half that is easy to lose. Without it the circles
		// escape into the page and the band stops reading as a band.
		expect(gradient).toContain("<BandGeometry");
		expect(gradient).toMatch(/band: \{ width: "100%", overflow: "hidden" \}/);
		// Both render paths get them, so `delivery` is not the one stage with a bare ramp.
		expect(gradient.match(/<BandGeometryWithFade/g)).toHaveLength(2);
	});

	test("the geometry dissolves into the exact page colour over the lower third", () => {
		// The base ramps already reach the page. This final veil exists for the solid geometry
		// painted above them, which would otherwise be clipped into a visible horizontal edge.
		expect(gradient).toContain(
			"const GEOMETRY_FADE_LOCATIONS = [0, 0.65, 1] as const",
		);
		expect(gradient).toContain(
			"colors={[withAlpha(page, 0), withAlpha(page, 0), page]}",
		);
		expect(gradient).toContain("locations={GEOMETRY_FADE_LOCATIONS}");
		expect(gradient).toMatch(
			/<BandGeometry[\s\S]*?<LinearGradient[\s\S]*?locations=\{GEOMETRY_FADE_LOCATIONS\}/,
		);

		// Geometry is measured against the container that actually clips it. Delivery has a
		// taller fluid band than the other journey states and must not reuse `bandHeight`.
		expect(gradient).toMatch(
			/<BandGeometryWithFade[\s\S]*?height=\{fluidHeight\}/,
		);
		expect(gradient).toMatch(
			/<BandGeometryWithFade[\s\S]*?height=\{bandHeight\}/,
		);
	});

	test("drawn with plain Views, not SVG — no native surface on the scrolling home screen", () => {
		// A deliberate departure from the obvious tool. `react-native-svg` is already a dependency,
		// but a clipped filled disc needs no path, no stroke and no gradient definition, and
		// `components/merchant-order-hero.tsx` already draws this exact form in this exact shape
		// language with three `View`s and a `borderRadius`.
		//
		// Reusing that keeps the home screen free of an SVG surface, a native view and a GPU
		// layer — the one genuinely performance-sensitive part of this work, on the screen that
		// scrolls. `expect(fluid).not.toMatch(/react-native-svg/)` above keeps the delivery ramp
		// clear of it too; this is the same rule for the file that owns the forms.
		const geometry = readFileSync(
			join(root, "components", "band-geometry.tsx"),
			"utf8",
		);
		expect(geometry).not.toMatch(/^import .*from "react-native-svg"/m);
		expect(geometry).not.toContain("<Svg");
		expect(geometry).toContain("borderRadius: 9999");
		expect(geometry).toContain('pointerEvents="none"');
		// Hung from one anchor by half a diameter each, which is what keeps them concentric when
		// the band's height changes. Three independent offsets only *look* concentric until then.
		expect(geometry).toContain("marginLeft: -size / 2");
		expect(geometry).toContain("marginTop: -size / 2");
		expect(geometry.match(/marginLeft: -size \/ 2/g)).toHaveLength(1);
	});

	test("static, and tinted toward the page rather than toward white", () => {
		// Static: the delivery band's breath already animates the ramp underneath, and two motions
		// in one surface read as a wobble rather than as design. Nothing here mounts an animation,
		// so `still` and `reduced` get the same shapes held — which is what those states promise
		// everywhere else in the band, and needs no special case because there is nothing to gate.
		const geometry = readFileSync(
			join(root, "components", "band-geometry.tsx"),
			"utf8",
		);
		expect(geometry).not.toMatch(
			/withRepeat|withTiming|useSharedValue|Animated/,
		);
		expect(geometry).not.toMatch(/requestAnimationFrame/);
		// Toward the page, not white: white at low alpha is invisible on the dark themes, where the
		// band top is still a bright lime. Moving toward the page always deviates from the band in
		// the direction the eye already reads as "not the band", in both schemes and on every hue.
		expect(geometry).toContain("mixOklab(color, page, 0.22)");
		expect(geometry).not.toContain('"#ffffff"');
		expect(geometry).not.toContain('"#FFFFFF"');
	});

	test("the forms take the anchored colour, so they agree with the ramp", () => {
		expect(gradient).toContain("const anchor = journeyBand ?? bandAnchor(");
		expect(gradient).toContain("color={anchor}");
		expect(gradient).toContain("page={backgroundColor}");
	});
});

describe("paints behind the safe area and home content", () => {
	test("without intercepting touch", () => {
		expect(screen).toContain(
			'<View style={StyleSheet.absoluteFill} pointerEvents="none">',
		);
		expect(screen).toContain(
			"const backdrop = background ?? ambientBackground",
		);
		expect(screen).toContain("<HomeGradient");
		expect(home).not.toContain("PurchaseWash");
	});
});

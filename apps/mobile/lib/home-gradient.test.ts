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
	test("dark takes the theme's own dark ink; light keeps `secondaryForeground`", () => {
		expect(header).toContain('colors.primary.toLowerCase() === "#c8ff18"');
		expect(header).toMatch(
			/const bandInk = onLimeGradient\s+\? scheme === "dark"\s+\? colors\.primaryForeground\s+: colors\.secondaryForeground\s+: undefined;/,
		);
	});

	test("the two nested tones take a dark-only ink, so light is untouched", () => {
		// These cannot read `bandInk`: in light their `tone` already resolves to `#111111`,
		// and `bandInk` would repaint them `#2e2722`. `limeDarkInk` is `undefined` in light,
		// so no style is attached and the element is byte-identical to what it was.
		expect(header).toContain("limeDarkInk");
		expect(header).toMatch(
			/const limeDarkInk =\s+onLimeGradient && scheme === "dark"/,
		);
		expect(header).toContain("const nestedInk = journeyInk ?? limeDarkInk");
		expect(
			header.match(/nestedInk \? \{ color: nestedInk \} : undefined/g),
		).toHaveLength(2);
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

	test("journey bands dissolve gradually rather than ending at the title", () => {
		expect(gradient).toContain("SMOOTH_LOCATIONS = [0, 0.28, 0.66, 1]");
		expect(gradient).toContain('stage === "basket" ||');
		expect(gradient).toContain("smoothBand ? withAlpha(journeyBand, 0.72)");
		expect(gradient).toContain("smoothBand ? 0.18");
	});

	test("delivery is top-attached fluid, not a repeating wave", () => {
		expect(gradient).toContain('stage === "delivery" && journeyBand');
		expect(gradient).toContain("<TopFluidGradient");
		expect(gradient).toContain("Math.min(height * 0.38, 380)");
		expect(fluid).toContain("<LinearGradient");
		expect(fluid).toContain("<SvgLinearGradient");
		expect(fluid).toContain("stopOpacity={0.16}");
		expect(fluid).not.toContain("strokeLinejoin");
		expect(fluid).toContain("<AnimatedPath");
		expect(fluid).toContain("useAnimatedProps<PathProps>");
		expect(fluid).toContain('viewBox="0 0 1000 380"');
		expect(fluid).toContain("L 1110 -24 Z");
		expect(fluid).not.toContain("Animated.Image");
		expect(fluid).not.toContain("delivery-wave");
	});

	test("five broad regions are neighbor-coupled and stop for reduced motion or hidden screens", () => {
		expect(fluid.match(/\{ period: [\d_]+, phase:/g)).toHaveLength(5);
		expect(fluid.match(/useRegionDriver\(REGIONS\[/g)).toHaveLength(5);
		expect(fluid).toContain('motion === "normal" && !reduceMotion');
		expect(fluid).toContain("spec.driftPeriod");
		expect(fluid).toContain("spec.secondaryPeriod");
		expect(fluid).toContain("previousMotion * 0.25");
		expect(fluid).toContain("nextMotion * 0.25");
		expect(fluid).toContain("cancelAnimation(primary)");
		expect(fluid).toContain("cancelAnimation(secondary)");
		expect(fluid).toContain("cancelAnimation(drift)");
		expect(gradient).toContain('focused ? fluidMotion : "still"');
		expect(fluid).toContain('pointerEvents="none"');
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

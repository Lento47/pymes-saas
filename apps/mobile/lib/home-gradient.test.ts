import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const gradient = readFileSync(
	join(root, "components", "home-gradient.tsx"),
	"utf8",
);
const screen = readFileSync(join(root, "components", "screen.tsx"), "utf8");
const home = readFileSync(join(root, "app", "(customer)", "index.tsx"), "utf8");
const header = readFileSync(
	join(root, "components", "home-header.tsx"),
	"utf8",
);

describe("home gradient", () => {
	test("uses a saturated lime-to-green gradient that fades by 52%", () => {
		expect(home).toContain("color={colors.primary}");
		expect(gradient).toContain('["#C8FF18", "#A9DE00", "#E2F4AC", "#FFFFFF"]');
		expect(gradient).toContain("locations={[0, 18 / 52, 35 / 52, 1]}");
		expect(gradient).toContain("height: height * 0.52");
	});

	test("uses a richer olive fade in dark mode and leaves other themes unchanged", () => {
		expect(gradient).toContain('["#455B16", "#2C3C0F", "#1A240F", "#0F0F0F"]');
		expect(gradient).toContain("withAlpha(color, strengths[0])");
		expect(gradient).toContain("withAlpha(color, strengths[3])");
		expect(screen).toContain("backgroundColor: colors.background");
	});

	test("uses contrasting header ink over the saturated lime", () => {
		expect(header).toContain('colors.primary.toLowerCase() === "#c8ff18"');
		expect(header).toContain("colors.secondaryForeground");
		expect(header).toMatch(
			/onLimeGradient && scheme === "light"\s+\? colors\.foreground\s+: colors\.primary/,
		);
	});

	test("paints behind the safe area and home content without intercepting touch", () => {
		expect(screen).toContain(
			'<View style={StyleSheet.absoluteFill} pointerEvents="none">',
		);
		expect(home).toContain(
			"background={<HomeGradient scheme={scheme} color={colors.primary} />}",
		);
		expect(home).not.toContain("PurchaseWash");
	});
});

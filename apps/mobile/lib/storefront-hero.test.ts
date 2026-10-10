import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const hero = readFileSync(
	join(import.meta.dir, "..", "components", "hero.tsx"),
	"utf8",
);
const store = readFileSync(
	join(import.meta.dir, "..", "app", "(customer)", "store", "[slug].tsx"),
	"utf8",
);

describe("storefront cover hero", () => {
	test("a cover is full-bleed and fades into the page canvas", () => {
		expect(hero).toContain("expo-linear-gradient");
		expect(hero).toContain("LinearGradient");
		expect(hero).toContain("colors.background");
		expect(hero).toContain("heroCover");
		expect(hero).toContain("leading");
		expect(hero).toContain("HERO_MIN_HEIGHT = 360");
		expect(hero).toContain("useSafeAreaInsets");
		expect(store).toContain("topInset={false}");
	});

	test("the storefront puts back on the hero instead of a padded row above it", () => {
		expect(store).toContain('<BackButton to="/" surface />');
		expect(store).not.toContain("style={card.coverUrl ? null : styles.pad}");
	});
});

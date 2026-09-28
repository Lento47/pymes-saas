import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The floating capsule must never be drawn over a screen's own action bar.
 *
 * The `(business)` bar is `position: "absolute"`, so it is out of the navigator's flex
 * flow and overlays whatever the last stretch of the screen draws. A screen that puts an
 * `ActionBar` at its foot therefore has two bars fighting for the same 90 points, and the
 * one that loses is the screen's single commit — the button that saves the product, the
 * hours, the pause. The five that own their floor solve it by hiding the capsule, and
 * these two tests are what stops a sixth screen from being added without that.
 *
 * **Read from source, not imported**, for the reason `lib/tab-routes.test.ts` reads its
 * layout the same way: `components/tab-bar.ts` imports `expo-router` and
 * `react-native-safe-area-context`, and neither resolves under `bun test`. The list is
 * therefore parsed out of the file, which is also what makes this a check on the *list*
 * rather than on the module's current value.
 *
 * The compile-time half of the same rule is `merchantBarlessOptions`' parameter type —
 * a name outside `MERCHANT_BARLESS_ROUTES` will not compile. What no compiler can see
 * is the direction this file covers: a screen that grows an `ActionBar` and is not on
 * the list at all.
 */

const APP = join(import.meta.dir, "..", "app");
const BUSINESS = join(APP, "(business)");
const TAB_BAR = join(import.meta.dir, "..", "components", "tab-bar.ts");

/** The route names `components/tab-bar.ts` lists as owning the foot of their screen. */
function barlessRoutes(): string[] {
	const source = readFileSync(TAB_BAR, "utf-8");
	const list = source.match(/MERCHANT_BARLESS_ROUTES\s*=\s*\[([\s\S]*?)\]/);
	if (list?.[1] === undefined) {
		throw new Error(
			"MERCHANT_BARLESS_ROUTES not found in components/tab-bar.ts",
		);
	}
	return [...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** `(business)` route files that render an `ActionBar`, by route name. */
function screensWithActionBar(): string[] {
	return readdirSync(BUSINESS)
		.filter((entry) => entry.endsWith(".tsx") && entry !== "_layout.tsx")
		.filter((entry) =>
			readFileSync(join(BUSINESS, entry), "utf-8").includes("<ActionBar"),
		)
		.map((entry) => entry.slice(0, -".tsx".length))
		.sort();
}

/** The names the layout actually hands to `merchantBarlessOptions`. */
function hiddenInLayout(): string[] {
	const source = readFileSync(join(BUSINESS, "_layout.tsx"), "utf-8");
	return [...source.matchAll(/merchantBarlessOptions\("([^"]+)"\)/g)]
		.map((match) => match[1] ?? "")
		.sort();
}

describe("(business) floating bar coverage", () => {
	test("every screen with an action bar hides the capsule", () => {
		expect(screensWithActionBar()).toEqual(barlessRoutes().sort());
	});

	test("the list and the layout agree, both ways", () => {
		expect(hiddenInLayout()).toEqual(barlessRoutes().sort());
	});
});

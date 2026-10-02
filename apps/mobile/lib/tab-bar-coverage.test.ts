import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The floating capsule must never be drawn over a screen's own action bar without a way out.
 *
 * The bar is `position: "absolute"`, so it is out of the navigator's flex flow and overlays
 * whatever the last stretch of the screen draws. A screen that puts an `ActionBar` at its foot
 * therefore has two bars fighting for the same ~150 points, and the one that loses is the
 * screen's single commit — the button that saves the product, the hours, the purchase.
 *
 * **The two trees answer that differently, and the difference is the point of this file.**
 *
 * `(business)` has one answer: hide the capsule. Every screen with an action bar is on
 * `MERCHANT_BARLESS_ROUTES`, full stop, and the first test below fails if one is not.
 *
 * `(customer)` has two, because a capsule that a reader cannot get out of is worse than a
 * crowded foot. A screen may either
 *
 * - **hide** it (`CUSTOMER_BARLESS_ROUTES`) — it owns its whole floor. Every one of those
 *   either has a `BackButton` of its own or is the far end of a flow with nowhere back to,
 *   so losing the bar costs the reader nothing; or
 * - **keep** it (`CUSTOMER_LIFTED_ROUTES`) — the screen has a title and no `BackButton`, so
 *   the bar is the way out, and `./action-bar` lifts itself above the capsule to make room.
 *
 * The second list is not read at runtime by anything. It exists so this file can ask *is every
 * screen with a bar accounted for?* on both trees, instead of inferring the second answer from
 * the absence of the first — which would read a screen that hid its capsule by accident as a
 * deliberate choice.
 *
 * **Read from source, not imported**, for the reason `lib/tab-routes.test.ts` reads its
 * layout the same way: `components/tab-bar.ts` imports `expo-router` and
 * `react-native-safe-area-context`, and neither resolves under `bun test`. The lists are
 * therefore parsed out of the file, which is also what makes this a check on the *lists*
 * rather than on the module's current values.
 *
 * The compile-time half of the same rule is `merchantBarlessOptions` and
 * `customerBarlessOptions` — their parameter types are members of their own list, so a name
 * outside it will not compile. What no compiler can see is the direction this file covers: a
 * screen that grows an `ActionBar` and is on neither list.
 */

const APP = join(import.meta.dir, "..", "app");
const BUSINESS = join(APP, "(business)");
const CUSTOMER = join(APP, "(customer)");
const TAB_BAR = join(import.meta.dir, "..", "components", "tab-bar.ts");

/** Route files under a group dir, recursing: `dir/[id].tsx` → `dir/[id]`. */
function routeFiles(groupDir: string, prefix = ""): string[] {
	return readdirSync(groupDir).flatMap((entry) => {
		if (entry === "_layout.tsx" || !entry.endsWith(".tsx")) {
			if (!entry.includes(".")) {
				const full = join(groupDir, entry);
				if (statSync(full).isDirectory()) {
					return routeFiles(full, `${prefix}${entry}/`);
				}
			}
			return [];
		}
		return [`${prefix}${entry.slice(0, -".tsx".length)}`];
	});
}

/** The route files in a group that render an `ActionBar`, by route name. */
function screensWithActionBar(groupDir: string): string[] {
	return routeFiles(groupDir)
		.filter((route) =>
			readFileSync(join(groupDir, `${route}.tsx`), "utf-8").includes(
				"<ActionBar",
			),
		)
		.sort();
}

/**
 * A `*_ROUTES` list, parsed out of `components/tab-bar.ts`.
 *
 * **Anchored on `] as const`, not on a bare `]`.** The obvious `\[([\s\S]*?)\]` looks right and
 * silently truncates every list that holds a dynamic route: `"order/[id]"` contains a `]`, the
 * lazy match stops inside the string literal, and the list parses as
 * `["checkout", "order/[id"]` — three entries where there are four, with the last one missing
 * its bracket. Every list here ends with `] as const;`, so that is the terminator. The
 * merchant list alone never showed the bug, because none of its six names has a bracket.
 */
function list(name: string): string[] {
	const source = readFileSync(TAB_BAR, "utf-8");
	const found = source.match(
		new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`),
	);
	if (found?.[1] === undefined) {
		throw new Error(`${name} not found in components/tab-bar.ts`);
	}
	return [...found[1].matchAll(/"([^"]+)"/g)]
		.map((match) => match[1] ?? "")
		.sort();
}

/** The names a layout hands to `merchantBarlessOptions` / `customerBarlessOptions`. */
function hiddenInLayout(groupDir: string, helper: string): string[] {
	const source = readFileSync(join(groupDir, "_layout.tsx"), "utf-8");
	return [...source.matchAll(new RegExp(`${helper}\\("([^"]+)"\\)`, "g"))]
		.map((match) => match[1] ?? "")
		.sort();
}

describe("(business) floating bar coverage", () => {
	const barless = list("MERCHANT_BARLESS_ROUTES");

	test("every screen with an action bar hides the capsule", () => {
		expect(screensWithActionBar(BUSINESS)).toEqual(barless);
	});

	test("the list and the layout agree, both ways", () => {
		expect(hiddenInLayout(BUSINESS, "merchantBarlessOptions")).toEqual(barless);
	});
});

describe("(customer) floating bar coverage", () => {
	const hidden = list("CUSTOMER_BARLESS_ROUTES");
	const lifted = list("CUSTOMER_LIFTED_ROUTES");

	test("every screen with an action bar either hides the capsule or lifts it", () => {
		const unaccounted = screensWithActionBar(CUSTOMER).filter(
			(route) => !hidden.includes(route) && !lifted.includes(route),
		);
		expect(unaccounted).toEqual([]);
	});

	test("the hidden list and the layout agree, both ways", () => {
		expect(hiddenInLayout(CUSTOMER, "customerBarlessOptions")).toEqual(hidden);
	});

	test("no screen is in both lists, because it cannot both hide and lift", () => {
		expect(hidden.filter((route) => lifted.includes(route))).toEqual([]);
	});

	/**
	 * `checkout` is on neither derivation, deliberately, and this test is where that is recorded.
	 *
	 * The tempting rule is "a screen with no `BackButton` must keep the bar", and it is wrong:
	 * `checkout` has no `BackButton` either, and hiding its bar is exactly right — it is the
	 * terminal step of a flow, so *nowhere to go back to* is the point rather than the problem.
	 * `cart` has the same missing button and the opposite answer, because the reader came from
	 * the feed and can return there.
	 *
	 * So the split cannot be derived from the file, and this suite deliberately does not try.
	 * What it checks instead is the part that *is* mechanical — every action-bar screen is on
	 * one list or the other — and leaves the choice, for the three screens that turn on it, to
	 * the two docblocks that justify it. A rule derived from `BackButton` would have been one
	 * more test and one more wrong answer.
	 */
	test("every action-bar screen is on exactly one list", () => {
		const bars = screensWithActionBar(CUSTOMER);
		for (const route of [...hidden, ...lifted]) {
			if (!bars.includes(route)) {
				throw new Error(
					`${route} is listed but draws no ActionBar — the list is stale`,
				);
			}
		}
		expect(bars).toHaveLength(hidden.length + lifted.length);
	});
});

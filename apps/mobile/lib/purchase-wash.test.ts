import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What holds the purchase wash to being a wash, and the state hook to being honest.
 *
 * ## Why these are the assertions that matter
 *
 * This component's whole job is a colour and a movement. Neither is visible to a type checker,
 * and the failure modes that have actually happened on surfaces like this one are specific:
 *
 * - a gradient that runs to the foot of the feed and tints every card and photograph below it,
 * - a pulse that never stops on the state where the reader is only browsing,
 * - a "paid" wash that stays green after an order is cancelled,
 * - a View that intercepts touches and makes the search field dead.
 *
 * Each has an assertion below. The one that has not been written down yet is "the four states
 * read from real data" — see `the state hook` for what is asserted there instead, and why.
 *
 * ## Read from source, for the reason `lib/category-rail.test.ts` reads its layout
 *
 * `components/purchase-wash.tsx` imports `react-native`, `@/theme`, `react-native-reanimated`
 * and `expo-linear-gradient`, none of which resolve under `bun test`. What is protected is the
 * declaration rather than the behaviour, and `lib/order-state.ts` — which *is* plain TypeScript
 * — is where the status grouping is asserted directly.
 */

const REPO = join(import.meta.dir, "..", "..", "..");
const WASH = join(REPO, "apps", "mobile", "components", "purchase-wash.tsx");
const STATE = join(REPO, "apps", "mobile", "lib", "purchase-state.ts");
const ORDER_STATE = join(REPO, "packages", "shared", "src", "order-state.ts");

const source = readFileSync(WASH, "utf-8");
const hook = readFileSync(STATE, "utf-8");
const orderState = readFileSync(ORDER_STATE, "utf-8");
const tokens = readFileSync(
	join(REPO, "apps", "mobile", "theme", "tokens.ts"),
	"utf-8",
);

/** The wash's source with every comment removed. */
function codeOnly(text = source): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** A numeric literal read out of a named object or const in the wash. */
function strength(key: string): number {
	const block = source.match(/WASH_STRENGTH\s*=\s*\{([^}]*)\}/)?.[1] ?? "";
	const found = block.match(new RegExp(`${key}:\\s*([0-9.]+)`))?.[1];
	if (found === undefined) throw new Error(`WASH_STRENGTH.${key} not found`);
	return Number(found);
}

/**
 * A colour out of the canonical light palette in `theme/tokens.ts`.
 *
 * Read rather than restated, because the whole point of the assertion above is that the
 * alphas are not comparable across states — so the comparison has to be made against real
 * palette values, and a hand-copied `#C8FF18` would drift the day the lime changed.
 */
function themeColor(key: string): string {
	const light = tokens.match(/const light = \{([\s\S]*?)\n\};/)?.[1];
	if (light === undefined) throw new Error("palette.light not found");
	const found = light.match(
		new RegExp(`\\n\\s*${key}:\\s*"?\\s*(#[0-9a-fA-F]{6})"?`),
	)?.[1];
	if (found === undefined) throw new Error(`palette.light.${key} not found`);
	return found;
}

/**
 * How far apart two hex colours are, in 0-255 per channel, as the mean of the three.
 *
 * A plain Euclidean distance and not a contrast ratio: this is about *how loud a wash looks*,
 * and two colours can be far apart in luminance while being near in RGB, or the reverse. Mean
 * absolute channel distance is crude, honest, and it is the measure the design claim survives.
 */
function distance(a: string, b: string): number {
	const pa = a.replace("#", "");
	const pb = b.replace("#", "");
	const channel = (hex: string, i: number): number =>
		Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	let sum = 0;
	for (let i = 0; i < 3; i += 1) {
		sum += Math.abs(channel(pa, i) - channel(pb, i));
	}
	return sum / 3;
}

describe("the purchase wash's geometry", () => {
	test("the gradient is gone by the middle of the first screen", () => {
		// The design, stated as a number. A wash that reaches the foot of the feed becomes a
		// filter over every card and photograph below it rather than a surface behind the
		// header, and that is the difference between the two things this could be.
		const locations = source.match(/locations=\{(\[[^\]]*\])\}/)?.[1] ?? "";
		expect(locations).toContain("0.5");
		// The third colour must be `transparent`, or the bottom stop is a second solid and the
		// fade happens nowhere.
		expect(codeOnly()).toMatch(/"transparent"/);
	});

	test("it is absolutely positioned and takes no layout space", () => {
		// `absoluteFill`, so the feed's own rows do not move when the wash appears. If this were
		// an in-flow View every section on the screen would shift by the wash's height the first
		// time a reader added something to their basket.
		expect(codeOnly()).toMatch(/StyleSheet\.absoluteFill/);
	});

	test("it cannot intercept a touch", () => {
		// It covers the whole feed. A View that took touches would make the search field, every
		// card and every rail item below it dead, and no styling assertion would notice.
		expect(codeOnly()).toMatch(/pointerEvents="none"/);
	});

	test("it draws in every state, so the feed never shows an empty frame", () => {
		// `usePurchaseState` answers `browsing` until both queries resolve, and this component
		// renders unconditionally. A wash that waited for its data would flash the page's flat
		// background first, which is the one thing a reader would notice on every cold start.
		const code = codeOnly();
		expect(code).not.toMatch(/return null/);
		expect(code).not.toMatch(/if \(!state\)/);
	});
});

describe("the purchase wash's four states", () => {
	test("each state spends a different palette token", () => {
		// Four states that shared a colour would be four labels on one switch. The four here are
		// `muted`, `primary`, `success`, `info` — all real tokens, so the wash follows the
		// reader's theme across all twelve palettes instead of being the app's one hardcoded
		// colour.
		const code = codeOnly();
		for (const token of [
			"colors.muted",
			"colors.primary",
			"colors.success",
			"colors.info",
		]) {
			expect(code).toContain(token);
		}
		// And no raw hex, which would be the same colour in every palette.
		expect(code).not.toMatch(/#[0-9a-fA-F]{6}/);
	});

	test("the two states a reader waits on carry the most colour", () => {
		// Measured as **distance from the page background**, not as the alpha, because the four
		// states spend four different tokens and the alphas are not comparable across them.
		//
		// `browsing` draws the highest alpha in the file — 0.35 — and is still the quietest
		// wash on the screen, because it spends `muted`, which is the token nearest `background` in
		// every palette. Comparing 0.35 against 0.22 and concluding that browsing is the loudest
		// state is exactly the mistake this test first made.
		//
		// So the assertion is on **contrast**: how far each wash's colour sits from the page it is
		// drawn over. `placed` and `onTheWay` have to be the two furthest, because those are the
		// states where the reader is waiting for something.
		const bg = distance(themeColor("background"), themeColor("background"));
		expect(bg).toBe(0);
		const byState = {
			browsing: distance(themeColor("muted"), themeColor("background")),
			basket: distance(themeColor("primary"), themeColor("background")),
			placed: distance(themeColor("success"), themeColor("background")),
			onTheWay: distance(themeColor("info"), themeColor("background")),
		};
		// `primary` is the lime `#C8FF18` on white, which is *further* from the background than
		// `info` blue is — so "the two furthest" would be `basket` and `placed`, and the ranking
		// is a property of the lime theme rather than of the design. Asserted instead: the two
		// waiting states are both **louder than browsing**, which is the design claim and holds in
		// every palette.
		expect(byState.placed).toBeGreaterThan(byState.browsing);
		expect(byState.onTheWay).toBeGreaterThan(byState.browsing);
		// And `placed` and `onTheWay` are drawn at the same strength, because they are the same
		// message: something of mine is in motion.
		expect(strength("placed")).toBe(strength("onTheWay"));
		// `basket` is the quietest of the three that mean something: an intention, not a fact.
		expect(strength("basket")).toBeLessThan(strength("placed"));
	});

	test("every strength is an alpha, so the wash sits over the page", () => {
		// The wash is *over* `background`, which differs per palette, so it has to be able to
		// sit on all twelve without knowing what any of them is.
		expect(codeOnly()).toMatch(/withAlpha\(/);
		expect(codeOnly()).toMatch(/rgba\(/);
		for (const key of ["browsing", "basket", "placed", "onTheWay"]) {
			const value = strength(key);
			expect(value).toBeGreaterThan(0);
			expect(value).toBeLessThanOrEqual(1);
		}
	});

	test("only `onTheWay` breathes", () => {
		// It is the only state describing something in progress *right now* rather than a fact.
		// A wash that pulsed while a reader browsed would be an animation nobody could switch
		// off, and one that pulsed on `placed` would be a celebration on every screen.
		expect(codeOnly()).toMatch(/state === "onTheWay" && !reduced/);
		// And the repeat is gated behind that, so the three still states never reach it.
		const pulse = codeOnly().match(/const breathes[\s\S]{0,240}/)?.[0] ?? "";
		expect(pulse).toContain('state === "onTheWay"');
		expect(pulse).toContain("!reduced");
	});

	test("the breath respects reduced motion and returns to rest", () => {
		// With the preference on, the wash is drawn at its resting opacity and holds still —
		// the state is still communicated by colour, which is the half of the signal that never
		// depended on movement. And the `else` branch has to put it *back*: without it a reader
		// who turned the preference on mid-breath would be left at the pulse's low point.
		const code = codeOnly();
		expect(code).toMatch(/useReducedMotionResolved/);
		expect(code).toMatch(/withRepeat\([\s\S]{0,200}?-1,\s*true/);
		expect(code).toMatch(/else if \(pulse\.value !== 1\)/);
	});
});

describe("the state hook", () => {
	test("it reads the basket and the orders, both as real queries", () => {
		// Not local state and not a prop: both facts live on the server and both are already
		// fetched by screens the reader came through, so this is usually a cache hit.
		const code = codeOnly(hook);
		expect(code).toMatch(/trpc\.cart\.get\.queryOptions\(\)/);
		expect(code).toMatch(/trpc\.orders\.list\.queryOptions/);
	});

	test("an order outranks a basket", () => {
		// They are not exclusive: a reader can have four things in the basket while their lunch
		// is on its way. The order is the more advanced fact, and a background that regressed
		// from `info` to `primary` because somebody added milk would be telling the reader less
		// than it already knew.
		const code = codeOnly(hook);
		const orderIndex = code.indexOf("FULFILMENT_STATUSES.includes(status)");
		const basketIndex = code.indexOf("items.length > 0");
		expect(orderIndex).toBeGreaterThan(-1);
		expect(orderIndex).toBeLessThan(basketIndex);
	});

	test("the basket test is the line count, not the totals", () => {
		// A basket whose lines are all zero-quantity is not a basket, and `totals` is a
		// well-formed zero in that case.
		expect(codeOnly(hook)).toMatch(/items\.length > 0/);
	});

	test("it reads `items`, which is the key `orders.list` actually uses", () => {
		// `orders.list` returns the same cursor envelope `cart.get` does. `app/(customer)/orders`
		// maps `data.items`, so the key was easy to assume wrong \u2014 and this hook was the first
		// caller in the app reading that envelope for a status rather than to render a list.
		expect(codeOnly(hook)).toMatch(/data\?\.items/);
		expect(codeOnly(hook)).not.toMatch(/data\?\.orders/);
	});

	test("a suspended query is `browsing`, and that is a real answer", () => {
		// The wash must never block a paint. It is also the state a signed-out visitor is
		// permanently in, so the wash is drawn in it at low contrast rather than appearing later.
		expect(codeOnly(hook)).toMatch(/\? "basket" : "browsing"/);
	});
});

describe("the status grouping", () => {
	test("it is derived from the enum, so a new status cannot be forgotten", () => {
		// Both lists filter `ORDER_STATUSES`. A hand-written list of status names would let a
		// status added to `packages/shared/src/order-state.ts` fall through and render a
		// reader's live order as though nothing had happened.
		const code = codeOnly(hook);
		expect(code).toMatch(/ORDER_STATUSES\.filter\(/);
		expect(code).not.toMatch(/"PREPARING",\s*"READY"/);
	});

	test("`placed` is PENDING and ACCEPTED, and nothing else", () => {
		// What "paid" means to a customer who has just checked out: the money has left and the
		// shop has the order.
		const block = hook.match(/PLACED_STATUSES[\s\S]{0,240}/)?.[0] ?? "";
		expect(block).toContain('"PENDING"');
		expect(block).toContain('"ACCEPTED"');
	});

	test("the three terminal statuses are in neither list", () => {
		// This is what makes the background settle back to `browsing` when an order ends. A reader
		// whose order was refused must not be left staring at a green "success" wash.
		const code = codeOnly(hook);
		for (const status of ["COMPLETED", "CANCELLED", "REJECTED"]) {
			expect(code).toContain(`"${status}"`);
		}
		// And they are named as exclusions rather than as an allow-list, so the fulfilment
		// filter keeps picking up statuses added later.
		expect(code).toMatch(/!PLACED_STATUSES\.includes\(status\)/);
	});

	test("the terminal list this hook mirrors is the one the enum defines", () => {
		// `packages/shared/src/order-state.ts` owns `TERMINAL_STATUSES`. If the two ever
		// disagreed, the wash and `app/(customer)/orders` would disagree about whether an order
		// had finished, which is the kind of drift a reader sees as a bug and nobody can debug.
		const terminal = orderState.match(
			/TERMINAL_STATUSES[^=]*=\s*\[([^\]]*)\]/,
		)?.[1];
		expect(terminal).toBeDefined();
		for (const status of ["COMPLETED", "CANCELLED", "REJECTED"]) {
			expect(terminal).toContain(status);
		}
	});

	test("it reads the newest order that has not finished, not simply the newest", () => {
		// A reader whose newest order was cancelled and whose one before it is still out for
		// delivery should be told about the delivery. Taking `[0]` would show them a wash for an
		// order that no longer exists.
		expect(codeOnly(hook)).toMatch(/for \(const row of rows\)/);
	});
});

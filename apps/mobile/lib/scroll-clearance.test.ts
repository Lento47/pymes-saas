import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A screen that draws its own scroller must reserve room for the capsule itself.
 *
 * ## The trap this exists to close
 *
 * `./screen` computes the capsule's clearance and applies it to the `ScrollView` **it renders
 * itself**. A screen that brings its own — for a sticky header, a `RefreshControl`, a segment
 * switcher, a bar that has to be a sibling so the last row cannot hide behind its button —
 * gets **nothing**. The capsule is `position: "absolute"`, so it overlays the foot of that
 * screen and the last card in the list is simply unreachable. Six customer screens own a
 * scroller and all six now spend the clearance themselves; this stops a seventh arriving
 * without it.
 *
 * **Barless routes are exempt, and that exemption is the point of reading the list.** A route
 * in `CUSTOMER_BARLESS_ROUTES` draws no capsule, so `useTabBarClearance` answers `0` there and
 * spending it would be dead arithmetic. A test that demanded the hook everywhere would be
 * pushing a pointless call into `checkout`, and the obvious response to that is to delete the
 * assertion.
 *
 * **Why it is read from source.** `./screen` and `./tab-bar` both import `expo-router` and
 * `react-native-safe-area-context`, neither of which resolves under `bun test`, so the rule
 * cannot be checked by calling the hook. Parsing the screens is also the only direction that
 * catches the mistake: the hook compiles fine on a screen that never spends the number, and
 * the failure is a pixel nobody notices until the last row is under the bar.
 */

const CUSTOMER = join(import.meta.dir, "..", "app", "(customer)");
const TAB_BAR = join(import.meta.dir, "..", "components", "tab-bar.ts");

/** Route files under the customer tree, recursing: `dir/[id].tsx` → `dir/[id]`. */
function routeFiles(dir: string, prefix = ""): string[] {
	return readdirSync(dir).flatMap((entry) => {
		if (entry === "_layout.tsx" || !entry.endsWith(".tsx")) {
			if (!entry.includes(".")) {
				const full = join(dir, entry);
				if (statSync(full).isDirectory())
					return routeFiles(full, `${prefix}${entry}/`);
			}
			return [];
		}
		return [`${prefix}${entry.slice(0, -".tsx".length)}`];
	});
}

/**
 * The opening `<Screen …>` tag, and nothing after it.
 *
 * **A regex cannot do this and a lazy one gets it wrong in the dangerous direction.**
 * `<Screen\b[\s\S]*?>` stops at the first `>`, which on a screen carrying
 * `leading={<BackButton to="/" />}` is the one *inside* that expression — so `scroll`, written
 * two lines further down, is read as absent. That reports a screen which hands its scroll to
 * `./screen` as one that owns it, which then fails for demanding a hook it does not need, which
 * is a false positive that teaches the next reader to distrust the file.
 *
 * So the tag is scanned rather than matched: `>` ends it only at brace depth zero and outside
 * a string. That is the whole of JSX's rule for where a tag ends, and it is short enough to
 * be obviously correct.
 */
function openingScreenTag(source: string): string | null {
	const start = source.indexOf("<Screen");
	if (start === -1) return null;
	let depth = 0;
	let quote: string | null = null;
	for (let i = start; i < source.length; i++) {
		const char = source[i];
		if (quote !== null) {
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'" || char === "`") {
			quote = char;
			continue;
		}
		if (char === "{") depth++;
		else if (char === "}") depth--;
		else if (char === ">" && depth === 0) return source.slice(start, i + 1);
	}
	return null;
}

/**
 * Whether the `scroll` prop is on that tag, as a *prop* rather than as a word.
 *
 * The quoted values are dropped first and the prop must then stand on its own. Two screens in
 * this repo carry the word in a place a bare `\bscroll\b` cannot tell from the prop — a title
 * that reads `scroll to the end`, and `contentStyle={styles.scroll}` — and either one reading
 * as the prop exempts that screen from the clearance rule. The failure is silent and points the
 * wrong way: the screen that most needs checking is the one the test declares safe.
 */
function screenOwnsScroll(source: string): boolean {
	const tag = openingScreenTag(source);
	if (tag === null) return false;
	const withoutStrings = tag.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
	return /(?:^|\s)scroll(?=\s|=|\/|$)/.test(withoutStrings);
}

/** `CUSTOMER_BARLESS_ROUTES`, parsed out of `components/tab-bar.ts`. */
function barlessRoutes(): string[] {
	const source = readFileSync(TAB_BAR, "utf-8");
	const found = source.match(
		/CUSTOMER_BARLESS_ROUTES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/,
	);
	if (found?.[1] === undefined) {
		throw new Error(
			"CUSTOMER_BARLESS_ROUTES not found in components/tab-bar.ts",
		);
	}
	return [...found[1].matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** Screens that draw a scroller of their own *and* have a capsule to clear. */
function ownScrollersUnderACapsule(): { route: string; source: string }[] {
	const barless = barlessRoutes();
	return routeFiles(CUSTOMER)
		.filter((route) => !barless.includes(route))
		.map((route) => ({
			route,
			source: readFileSync(join(CUSTOMER, `${route}.tsx`), "utf-8"),
		}))
		.filter(
			({ source }) =>
				/<ScrollView|<FlatList|<Animated\.ScrollView/.test(source) &&
				!screenOwnsScroll(source),
		);
}

describe("screens that own their scroller", () => {
	const owners = ownScrollersUnderACapsule();

	test("there are screens to check, so this file cannot pass vacuously", () => {
		expect(owners.length).toBeGreaterThan(0);
	});

	test("every one of them spends the capsule clearance", () => {
		const silent = owners
			.filter(({ source }) => !source.includes("useTabBarClearance"))
			.map(({ route }) => route);
		expect(silent).toEqual([]);
	});

	test("and each spends it on a paddingBottom, not merely calls the hook", () => {
		// The hook alone is not enough: it has to reach a `paddingBottom`. A screen that
		// calls it and never adds it fails exactly as hard as one that never called it, and
		// it is the easier mistake to make while refactoring.
		const unpaid = owners
			.filter(
				({ source }) =>
					source.includes("useTabBarClearance") &&
					!/paddingBottom[^;{]*\b(capsule|clearance)\b/.test(source),
			)
			.map(({ route }) => route);
		expect(unpaid).toEqual([]);
	});
});

describe("the opening-tag scanner", () => {
	test("reads `scroll` from past the `>` inside `leading={…}`", () => {
		expect(
			screenOwnsScroll(
				`<Screen
	title="x"
	leading={<BackButton to="/" />}
	scroll
	contentStyle={styles.page}
>`,
			),
		).toBe(true);
	});

	test("and still says no when the tag has no `scroll`", () => {
		expect(screenOwnsScroll(`<Screen title="x" padded={false}>`)).toBe(false);
		expect(
			screenOwnsScroll(`<Screen title="x" leading={<B to="/" />} />`),
		).toBe(false);
	});

	test("does not mistake an attribute value for the prop", () => {
		// `scroll` inside a string is a value, not the prop, and treating it as the prop would
		// exempt a screen from the rule for no reason.
		expect(screenOwnsScroll(`<Screen title="scroll to the end" />`)).toBe(
			false,
		);
	});
});

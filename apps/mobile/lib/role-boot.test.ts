import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const role = readFileSync(join(root, "lib", "role.ts"), "utf8");
const prefs = readFileSync(join(root, "lib", "device-prefs.ts"), "utf8");
const rootLayout = readFileSync(join(root, "app", "_layout.tsx"), "utf8");
const indexRoute = readFileSync(join(root, "app", "index.tsx"), "utf8");

/** `useResolvedRole()` bodies, so a helper defined elsewhere cannot be what trips these. */
function hookBody(): string {
	const start = role.indexOf("export function useResolvedRole");
	expect(start).toBeGreaterThan(-1);
	return role.slice(start);
}

/** Comments stripped, so a rule about the old code in a docblock cannot fail a rule about the
 *  new code — and, more importantly, so deleting an explanation cannot silently pass a test
 *  that was written to catch the behaviour. */
function code(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/**
 * The role answer must be **one** answer, and these are the tests that hold it there.
 *
 * ## What was actually wrong
 *
 * `useResolvedRole()` used to keep `loaded` in `useState` and call `initDevicePrefs()` in an
 * effect — per hook instance. There are four instances: three in `app/_layout.tsx` and one in
 * `app/index.tsx`. Each one started its own concurrent AsyncStorage read and flipped from
 * `state: "boot"` to `state: "ready"` on whichever read landed first.
 *
 * Two of those four copies answer a question with navigation consequences. `app/index.tsx`
 * decides the destination tree from its copy — it renders `<Redirect href="/(customer)" />` —
 * and `app/_layout.tsx`'s `ThemedStack` decides from its copy whether the root Stack has
 * registered the `(customer)` route, because `(customer)` sits inside
 * `<Stack.Protected guard={role === "customer"}>`. A copy that becomes ready first dispatches
 * `REPLACE` with payload `{"name":"(customer)"}` into a Stack that has not registered
 * `(customer)`; React Navigation calls that unhandled, expo-router logs it, the action is
 * dropped, and the reader is left on a screen whose entire output is the redirect that never
 * fired.
 *
 * That is the reported warning, and it is not a cosmetic one.
 *
 * ## Why this is a source test and not a render test
 *
 * Nothing in this suite can load `react-native` or `@react-native-async-storage/async-storage`,
 * which is why `theme/business-theme-ids.ts` exists as an import-free file — and `lib/role.ts`
 * imports both. Rendering the hook is not available here, so these assert the shape of the
 * source instead: that the boot flag is a shared store and the first read is made once. That is
 * the same technique `lib/home-gradient.test.ts` and `lib/tab-bar-coverage.test.ts` already use
 * in this repo, and it fails loudly on the specific reintroduction, which a behaviour test
 * could not do without a renderer.
 */
describe("the role answer is resolved once, not once per hook instance", () => {
	test("`lib/role.ts` holds no per-instance boot state", () => {
		const body = code(hookBody());
		// The regression, named exactly. `useState` here is what made four boot clocks.
		expect(body).not.toContain("useState");
	});

	test("`lib/role.ts` subscribes to the shared flag instead of setting it", () => {
		const body = code(hookBody());
		expect(body).toContain("subscribePrefsLoaded");
		// Both snapshots are the same getter: the module value is identical on either side and
		// lies about nothing, which is what lets the server render agree with the first client
		// render instead of booting twice.
		expect(body).toMatch(
			/useSyncExternalStore\(\s*subscribePrefsLoaded,\s*getPrefsLoaded,\s*getPrefsLoaded,?\s*\)/,
		);
	});

	test("`lib/role.ts` does not start its own storage read", () => {
		// `initDevicePrefs` re-reads storage on every call — "refresh the in-memory copy" is a
		// contract other code depends on — so the boot path must go through the guarded read.
		expect(code(hookBody())).not.toContain("initDevicePrefs()");
		expect(code(hookBody())).toContain("ensureDevicePrefsLoaded()");
	});

	test("`lib/device-prefs.ts` makes the first read exactly once", () => {
		const body = code(prefs);
		// The guard, so four callers produce one AsyncStorage read rather than four.
		expect(body).toContain("if (prefsLoad !== null) return;");
		expect(body).toMatch(/prefsLoad = initDevicePrefs\(\)/);
		// And it publishes, rather than letting each caller notice for itself.
		expect(body).toMatch(/prefsLoaded = true/);
		expect(body).toMatch(
			/for \(const listener of prefsLoadedListeners\) listener\(\)/,
		);
	});

	test("`lib/device-prefs.ts` still exposes the refresh contract", () => {
		// The once-only read is an addition, not a replacement: `initDevicePrefs` keeps
		// re-reading, because `app/_layout.tsx` calls it at start-up and a caller that wants
		// fresh storage must still be able to ask for it. Collapsing the two would have been a
		// smaller diff and a behaviour change nobody asked for.
		const body = code(prefs);
		expect(body).toMatch(
			/export async function initDevicePrefs\(\): Promise<void>/,
		);
		expect(body).toMatch(/export function getPrefsLoaded\(\): boolean/);
		expect(body).toMatch(
			/export function subscribePrefsLoaded\(listener: \(\) => void\): \(\) => void/,
		);
	});

	test("every consumer reads the same flag, so no screen can boot ahead of the navigator", () => {
		// The two call sites whose disagreement produced the warning: one chooses the
		// destination, the other registers it.
		expect(code(indexRoute)).toContain("useResolvedRole()");
		expect(code(rootLayout)).toContain("useResolvedRole()");
		// Neither is allowed to reach for storage itself, which would reintroduce a clock that
		// the navigator cannot see.
		expect(code(indexRoute)).not.toContain("AsyncStorage");
		expect(code(indexRoute)).not.toContain("initDevicePrefs");
	});

	test("the destination route is guarded in the navigator that has to receive it", () => {
		// Documents the coupling this fix exists to satisfy: `app/index.tsx` redirects to a
		// group, and that group is only a route while the guard holds, so the redirect is only
		// safe if both sides read the same answer. If someone removes the guard, this fails
		// before the warning does.
		expect(code(rootLayout)).toContain(
			'<Stack.Protected guard={role === "customer"}>',
		);
		expect(code(rootLayout)).toContain('<Stack.Screen name="(customer)" />');
		expect(code(indexRoute)).toContain('"/(customer)"');
	});
});

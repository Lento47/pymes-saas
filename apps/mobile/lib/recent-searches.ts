import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * What this phone last looked for, newest first.
 *
 * A search screen's empty state is the one surface with nothing to draw and something useful
 * to offer, and a term the customer already typed is the cheapest thing to put there. No
 * screen draws it today — the section below says why, and what a screen wanting it back would
 * inherit. It is device-local by design: there is no `recentSearches` procedure on the API, no row and
 * no sync, because a search a person typed on their own phone is not a fact the marketplace
 * needs to keep about them.
 *
 * ## What reads it now: the feed's in-place search
 *
 * The idle state it was originally written for is gone: the `/search` screen's idle state is
 * the field and the category rail, and a history under the heading competed with the one row
 * that says what this marketplace sells. The module found its caller anyway —
 * `app/index.tsx`'s in-place search calls `rememberSearch` at the keyboard's search key and
 * draws the list through `readRecentSearches` when the field opens, which is exactly the rule
 * the next section states. The `/search` screen draws no history of its own.
 *
 * It is kept rather than deleted for two reasons. Its rule about *when* a term is remembered is
 * the hard half of the feature and is not obvious: the search screen's 300ms debounce settles on
 * every pause a typist takes, so "what the query settled on" would file "ca", "caf" and "café"
 * as three searches — which is why remembering happens at the keyboard's search key and at
 * end-of-editing, and never on the debounce. And `docs/design-mobile.md`'s Rule 7 names this file
 * in its table of primitives, so a screen that wants a history again has one place to read from
 * rather than a second implementation to grow. Deleting it would take both with it; leaving it
 * costs a module nobody imports.
 *
 * ## `AsyncStorage`, and not `expo-secure-store`
 *
 * The two stores in this app are not interchangeable and the split is deliberate.
 * `lib/auth/session.tsx` keeps the credential — a bearer token — in the OS keychain through
 * `@pymeshub/auth`, and holds none of it itself: a secret belongs in the keychain and nowhere
 * a bundle can read it. **A search term is not a secret.** It is a preference, the same kind
 * of value as the locale, and `lib/i18n.tsx` writes the locale through `AsyncStorage` for the
 * same reason.
 *
 * There is a second, harder reason and it is measured: `expo-secure-store`'s web shim is
 * `export default {}`, so on the web target every read *throws* a `TypeError` — that defect is
 * written down in `docs/design-mobile.md` beside the export gate, and it is why the web client
 * moved off the token transport entirely. `AsyncStorage` is backed by `localStorage` on web and
 * works, which is what lets the search screen render the same thing on all three targets.
 *
 * ## Everything here returns the list, and nothing here throws
 *
 * The storage is the truth, so each function answers with what is *now* stored and the caller
 * sets its state from that one value: a list held separately in React and in `AsyncStorage` is
 * two lists that can disagree about a term the customer just typed. A read that fails returns
 * `[]` — an empty history — which removes the feature rather than throwing at the search screen
 * over a preference. That is the house rule for a missing capability, and the same answer
 * `./map` gives when the native map module is absent.
 */

/**
 * The key, namespaced the way `LOCALE_COOKIE` is (`pymeshub_locale`) so the two storage
 * conventions in this app read as one.
 *
 * Unlike the locale key, this one is deliberately *not* shared with the web app, and the web
 * *does* keep a history: `apps/web/components/catalog/recent-searches.ts` stores it under
 * `pymeshub.searches` and its search screen draws it under the `search.recent` heading. The two
 * are not one feature with two spellings — the web's sits above a page of results that is
 * already on screen, this one was written for an idle state that has no results at all, so
 * they hold different lists and change at different moments. One shared key would make each
 * client read terms the other wrote under rules it does not keep, which is exactly the coupling
 * `LOCALE_COOKIE` was kept for.
 */
const KEY = "pymeshub_recent_searches";

/**
 * Eight, and no more.
 *
 * The list was sized as a search screen's empty state rather than as a history: past eight
 * entries it stops being something a reader scans and starts being a second list to search.
 * Eight is also about what fits above the keyboard-less fold on the smallest supported device
 * at default text size. A screen that drew this as a full history — a whole tab of it, say —
 * would want a different number, and that is a decision for that screen rather than this one.
 */
const LIMIT = 8;

/**
 * 120 characters, which is `catalog.search`'s own ceiling.
 *
 * That procedure's input is `z.object({ q: z.string().trim().min(1).max(120) })`, so a term
 * longer than this is one the API would refuse. Storing it would put a suggestion on the screen
 * that fails the moment it is tapped, which is the whole value of the list gone.
 */
const MAX_LENGTH = 120;

const NOOP = () => {};

/**
 * One writer at a time.
 *
 * Every function here is read-modify-write, and the call site this was written for fired
 * `rememberSearch` from the field's own settle rather than from a render. Two settles close
 * together — a fast typist, a "buscar" tap on the keyboard's action key — would otherwise both
 * read the list as it was before either wrote, and the first term would be silently lost.
 * Chaining costs four lines and is the difference between "most recent first" being true and
 * being usually true. That hazard belongs to the store rather than to that one screen, so the
 * chain stays whether or not anything is calling it.
 *
 * The tail swallows both outcomes so a failed write cannot leave an unhandled rejection behind
 * it, which on this runtime is a red box rather than a log line.
 */
let tail: Promise<void> = Promise.resolve();

function serialized<T>(run: () => Promise<T>): Promise<T> {
	const result = tail.then(run, run);
	tail = result.then(NOOP, NOOP);
	return result;
}

/** The stored terms, newest first. `[]` for anything that is not a list of strings. */
export async function readRecentSearches(): Promise<string[]> {
	try {
		const raw = await AsyncStorage.getItem(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		// The shape is this file's to defend: storage outlives the code that wrote it, so a
		// value from an older build is a thing that reaches a screen rather than a hypothetical.
		return parsed
			.filter((term): term is string => typeof term === "string")
			.slice(0, LIMIT);
	} catch {
		// No storage, no history, no error. See the docblock.
		return [];
	}
}

/**
 * Put `term` at the front, and answer with the list that results.
 *
 * Case-insensitive de-duplication, but the **newest spelling wins**: searching `Café` after
 * `café` moves one entry to the front rather than leaving two that a reader would read as a
 * bug. A term that is empty once trimmed is not a search and is not remembered — `catalog.search`
 * requires `min(1)` after the same trim.
 *
 * A write that fails answers with what is actually stored rather than with the list the customer
 * hoped for, so the screen and the storage keep saying the same thing. The alternative — showing
 * a term the write dropped — is a suggestion that disappears on the next launch.
 */
export async function rememberSearch(term: string): Promise<string[]> {
	const trimmed = term.trim().slice(0, MAX_LENGTH);
	if (!trimmed) return readRecentSearches();

	return serialized(async () => {
		const current = await readRecentSearches();
		const folded = trimmed.toLowerCase();
		const next = [
			trimmed,
			...current.filter((entry) => entry.toLowerCase() !== folded),
		].slice(0, LIMIT);

		try {
			await AsyncStorage.setItem(KEY, JSON.stringify(next));
			return next;
		} catch {
			return current;
		}
	});
}

/**
 * Forget all of it, and answer with what is left.
 *
 * `[]` when the removal worked — that is the stored state — and the list as it actually still
 * is when it did not, for the same reason `rememberSearch` reports what is stored rather than
 * what was intended.
 *
 * There is no "clear history" control anywhere today, and `search.clear` is not one: it is the
 * query field's own label in `app/search`, `app/store/[slug]` and the web screen, and it
 * empties the box rather than this list. A screen that added one would owe this behaviour —
 * it must not empty itself in front of a customer whose storage refused the write.
 */
export async function clearRecentSearches(): Promise<string[]> {
	try {
		await AsyncStorage.removeItem(KEY);
		return [];
	} catch {
		return readRecentSearches();
	}
}

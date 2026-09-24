import { useEffect, useState } from "react";

/**
 * A value that keeps still while it is changing.
 *
 * The search box needs one: a request per keystroke is a request per keystroke on a phone
 * network, and `catalog.search` is rate-limited by IP. The timer lives here rather than in
 * the screen, for the reason `./location`'s permission round trip does — a component that
 * owns a `setTimeout` owns clearing it on every path out, and the timer that outlives its
 * screen is the one that fires a beat after the reader has left.
 *
 * The first render returns `value` itself and not a placeholder: a debounce is for *changes*,
 * and delaying the initial value would make every mount start on the empty value and fill in
 * a moment later, which on a query key is a second request for an answer already in hand.
 *
 * It holds its argument and nothing else. What counts as a change worth waiting for — a
 * trimmed string, a two-character floor — stays with the caller, because that is a fact about
 * the input rather than about time.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [settled, setSettled] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);

	return settled;
}

/**
 * Everything about a crash payload that can be decided without a network, a React tree or a
 * phone — in a file that imports none of them.
 *
 * ## Why this is its own module
 *
 * `error-reporting.ts` imports `@trpc/client`, `expo-constants` and `react-native`, none of
 * which load under `bun test`. Splitting is not tidiness: it is the only way the parts worth
 * being right are covered at all. The rules that decide whether a report survives the contract
 * — the bounds, the normalisation of whatever the runtime threw, the shape of the route — are
 * exactly the rules that are cheap to get subtly wrong and expensive to notice, because the
 * symptom is a *missing report* rather than a visible failure.
 *
 * The split matches the other modules in this directory that exist to be tested: `sign-out-intent`
 * is a module value with no React in it, `purchase-colors` is pure arithmetic over palettes,
 * and both are imported by tests while their callers are not.
 */

/**
 * The contract's bounds, restated from `crashReportInput` in
 * `packages/shared/src/schemas/crash-report.ts`.
 *
 * This is a copy of another file's numbers and it will rot. It is here anyway, because the
 * failure without it is worse than the duplication: zod **rejects the whole object** on a
 * too-long field rather than trimming it, so one oversized stack trace — a minified Hermes
 * bundle can produce one — discards the entire report, route and version included. Trimming
 * first turns "the report is lost" into "the tail of the stack is lost", and the head is the
 * part that names the frame that threw.
 *
 * `error-reporting.test.ts` reads the numbers back out of the schema and fails when these drift.
 */
export const MESSAGE_MAX = 2000;
export const TITLE_MAX = 200;
export const STACK_MAX = 20_000;
export const ROUTE_MAX = 300;

/** Trim to `max`, marking the cut so a reader never mistakes a truncated stack for a whole one. */
export function clipped(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * The route, as an operator would name the screen.
 *
 * `useSegments()` yields `(customer)/cart/[id]` and this prefixes the slash, giving
 * `/(customer)/cart/[id]` — the path under `app/`, group in front. That is the name a person
 * reading a report would use to find the file, and it is what `lib/tab-routes.test.ts` already
 * walks.
 *
 * Empty segments mean "no route yet", which is a real state rather than a degenerate one: a
 * rejection can arrive before the navigator has settled, and `route: null` is a row an operator
 * can still read. `null` rather than `"/"` because `"/"` is a claim about a screen.
 */
export function crashRoutePath(segments: readonly string[]): string | null {
	const parts = segments.filter((segment) => segment.length > 0);
	return parts.length > 0 ? `/${parts.join("/")}` : null;
}

let currentRoute: string | null = null;

/**
 * The screen the app was on, as a module value.
 *
 * A rejection arrives with no React tree and the boundary is told only about itself, so neither
 * can ask `usePathname()` at the moment it matters. `app/_layout.tsx` already calls
 * `useSegments()` for the status bar, so the value is written from there rather than from a
 * second subscription.
 *
 * A module rather than context on purpose: a crash handler that has to wait for a provider to
 * mount is a crash handler that misses the crash.
 */
export function setCrashRoute(route: string | null): void {
	currentRoute = route;
}

/** The route last seen, for a report that arrives from outside the tree. */
export function crashRoute(): string | null {
	return currentRoute;
}

/**
 * Whatever the runtime handed us, as an `Error`.
 *
 * Two of the three paths into the crash screen cannot promise an `Error`:
 *
 * - A **promise rejection's reason is any value.** `Promise.reject("no hay stock")` is legal,
 *   and the reason reaches the boundary exactly as written. `GlobalErrorBoundary` types its
 *   `error` as `unknown` for this reason and falls back to `new Error("Unknown global error")`
 *   when there is nothing better.
 * - React Native's `ErrorUtils` global handler is called by native code whose payload shape this
 *   app does not control.
 *
 * A string becomes an `Error` rather than being stringified at three call sites, because
 * `error.stack` is the field the whole queue is read for and a synthesised `Error` is the only
 * way to get one out of a rejected string. An object carrying `{message, stack}` keeps its
 * stack: a rejection reason thrown by a compiled module often has both, and losing the second
 * would lose the part worth reading.
 */
export function crashError(value: unknown): Error {
	if (value instanceof Error) return value;

	if (typeof value === "string" && value.length > 0) return new Error(value);

	if (value !== null && typeof value === "object") {
		const message = (value as { message?: unknown }).message;
		if (typeof message === "string" && message.length > 0) {
			const error = new Error(message);
			const stack = (value as { stack?: unknown }).stack;
			if (typeof stack === "string" && stack.length > 0) error.stack = stack;
			return error;
		}
	}

	return new Error("Unknown global error");
}

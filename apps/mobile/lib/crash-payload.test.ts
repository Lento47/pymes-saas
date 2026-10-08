import { describe, expect, test } from "bun:test";
import { crashReportInput } from "@pymeshub/shared";

import {
	clipped,
	crashError,
	crashRoute,
	crashRoutePath,
	MESSAGE_MAX,
	ROUTE_MAX,
	STACK_MAX,
	setCrashRoute,
	TITLE_MAX,
} from "./crash-payload";

/**
 * The crash payload's rules, asserted against the contract rather than against a copy of it.
 *
 * The three claims here are each a way a report could be **lost silently**, which is the one
 * failure mode this whole feature has and cannot afford:
 *
 * 1. **A payload the contract rejects takes the whole report with it.** zod does not trim a
 *    too-long field, it fails the object — so an over-long stack discards the route, the version
 *    and the build number along with the stack. `clipped` is the mitigation and the numbers it
 *    uses are read back out of `crashReportInput` below, so the copy in `crash-payload.ts`
 *    cannot drift from the schema it mirrors.
 * 2. **A rejection reason is not an `Error`.** `Promise.reject("no hay stock")` is legal and
 *    reaches the boundary as written. Losing it, or crashing on it, loses the report.
 * 3. **A route is a screen name, not a guess.** `/(customer)/cart/[id]` is the path an operator
 *    reads; `null` is a row they can still read rather than a wrong one.
 */

/**
 * The largest value `crashReportInput` will accept for a field, **found by asking it**.
 *
 * Not read off the schema object: `z.string().trim().min(1).max(2000)` keeps both limits in an
 * internal `checks` array with no `max` property to read, and reaching into that is a zod
 * version's business rather than this repository's. A binary search over `safeParse` asks the
 * question that actually matters — *what is the biggest report that survives* — and keeps
 * answering it correctly after a zod upgrade.
 */
function boundOf(field: "message" | "title" | "stack" | "route"): number {
	const accepted = (length: number) =>
		crashReportInput.safeParse({
			category: "UNHANDLED_ERROR",
			severity: "ERROR",
			message: field === "message" ? "x".repeat(length) : "checkout threw",
			[field]: "x".repeat(length),
		}).success;

	if (!accepted(1))
		throw new Error(`crashReportInput rejects every value of ${field}`);

	// `message` also has `.min(1)`, and `title`/others are `.optional()`, so a probe has to
	// keep the rest of the payload valid rather than vary one field at a time.
	let low = 1;
	let high = 1 << 17;
	while (low < high) {
		const middle = Math.ceil((low + high) / 2);
		if (accepted(middle)) low = middle;
		else high = middle - 1;
	}
	return low;
}

describe("the client trims to the contract's own bounds", () => {
	test("every bound is read back out of crashReportInput", () => {
		expect(MESSAGE_MAX).toBe(boundOf("message"));
		expect(TITLE_MAX).toBe(boundOf("title"));
		expect(STACK_MAX).toBe(boundOf("stack"));
		expect(ROUTE_MAX).toBe(boundOf("route"));
	});

	test("a payload at the bound is accepted whole", () => {
		const payload = {
			category: "UNHANDLED_ERROR" as const,
			severity: "ERROR" as const,
			message: clipped("x".repeat(MESSAGE_MAX), MESSAGE_MAX),
			title: clipped("y".repeat(TITLE_MAX), TITLE_MAX),
			stack: clipped("z".repeat(STACK_MAX), STACK_MAX),
			route: clipped("r".repeat(ROUTE_MAX), ROUTE_MAX),
		};
		expect(crashReportInput.safeParse(payload).success).toBe(true);
	});

	test("and one field over the bound is still accepted, because it was clipped", () => {
		// The regression this whole module exists for: without `clipped`, the oversized stack
		// below fails the parse, and zod's failure drops the message and the route with it —
		// so one long trace loses the whole report rather than the tail of one field.
		const oversized = {
			category: "UNHANDLED_ERROR" as const,
			severity: "ERROR" as const,
			message: "checkout threw",
			stack: clipped("z".repeat(STACK_MAX + 5000), STACK_MAX),
		};
		expect(crashReportInput.safeParse(oversized).success).toBe(true);
		// ...and the untrimmed version is genuinely rejected, which is why the trim matters.
		expect(
			crashReportInput.safeParse({
				...oversized,
				stack: "z".repeat(STACK_MAX + 5000),
			}).success,
		).toBe(false);
	});

	test("a clipped value is marked as cut, never silently shortened", () => {
		// A stack that ends mid-frame reads as a stack that ended there. The ellipsis is the
		// difference between "the head we have" and "all of it".
		expect(clipped("abcdefghij", 5)).toBe("abcd…");
		expect(clipped("abcde", 5)).toBe("abcde");
	});
});

describe("whatever the runtime threw becomes an Error", () => {
	test("a real Error passes through untouched", () => {
		const original = new TypeError("x is not a function");
		expect(crashError(original)).toBe(original);
	});

	test("a rejected string keeps its words and gains a stack to read", () => {
		// `Promise.reject("no hay stock")` is legal and reaches the boundary as a string.
		// `error.stack` is the field the whole queue is read for, so a string reason has to
		// become a real Error rather than being stringified at a call site.
		const error = crashError("no hay stock");
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe("no hay stock");
		expect(typeof error.stack).toBe("string");
	});

	test("an error-shaped object keeps both its message and its stack", () => {
		// A rejection reason thrown from a compiled module routinely carries both, and losing
		// the second loses the part that says where.
		const error = crashError({
			message: "Roll could not resolve",
			stack: "resolveRole (role.ts:88)",
		});
		expect(error.message).toBe("Roll could not resolve");
		expect(error.stack).toBe("resolveRole (role.ts:88)");
	});

	test("nothing usable still yields something reportable", () => {
		// The same fallback `Sentry.GlobalErrorBoundary` uses. A crash screen that renders
		// "Unknown global error" is a report an operator can still read; one that throws here
		// is a crash inside the crash handler.
		for (const value of [null, undefined, 0, "", {}, [], { message: "" }]) {
			const error = crashError(value);
			expect(error).toBeInstanceOf(Error);
			expect(error.message.length).toBeGreaterThan(0);
		}
	});
});

describe("the route is the screen, or nothing", () => {
	test("a route group is in front of the path, the way it is on disk", () => {
		expect(crashRoutePath(["(customer)", "cart", "[id]"])).toBe(
			"/(customer)/cart/[id]",
		);
		expect(crashRoutePath(["(business)", "support", "new"])).toBe(
			"/(business)/support/new",
		);
	});

	test("no segments is no route, rather than a claim about the root", () => {
		// A rejection can arrive before the navigator settles. `null` is a row an operator can
		// still read; `"/"` would name a screen nobody was on.
		expect(crashRoutePath([])).toBeNull();
		expect(crashRoutePath([""])).toBeNull();
	});

	test("the last route is remembered, because a handler cannot ask for it", () => {
		setCrashRoute(null);
		expect(crashRoute()).toBeNull();
		setCrashRoute("/(customer)/cart");
		expect(crashRoute()).toBe("/(customer)/cart");
		setCrashRoute(null);
	});
});

import { describe, expect, test } from "bun:test";

import {
	requestSignOutNavigation,
	takeSignOutNavigation,
} from "./sign-out-intent";

/**
 * The sign-out note, tested as the rule rather than as a rendered screen.
 *
 * `./sign-out-intent.ts` imports nothing, for the reason `theme/select.ts` is its own file:
 * no test in this repo loads `react-native`, so a module that can be imported bare is a
 * module that can be tested at all. The behaviour that matters is three claims, and each one
 * below is a way the note could be wrong in a way no screen would show.
 *
 * The module holds state, so these tests share it and the order is the subject — which is the
 * one thing a module-scoped note has to get right and the reason it is a note rather than a
 * prop. A prop would be scoped to the screen that set it, and the screen is gone.
 */

describe("the sign-out note", () => {
	test("is absent until something asks for it", () => {
		// The first test in the file, and it is load-bearing: a note that starts set sends
		// every cold start that lands in the navigator to the sign-in form, which is the
		// failure this whole mechanism would be worse than the bug it fixes.
		expect(takeSignOutNavigation()).toBeNull();
	});

	test("is readable exactly once after a request", () => {
		requestSignOutNavigation("authenticate");
		expect(takeSignOutNavigation()).toBe("authenticate");

		// The second read is the one that matters. Without the clear, the gate in
		// `app/_layout.tsx` would fire on every later frame the session reported
		// "signed-out" — which, after a successful sign-out, is every frame.
		expect(takeSignOutNavigation()).toBeNull();
	});

	test("offers no way to clear a note except reading it", async () => {
		// This is the mechanism behind the "safe to leave set" argument in the module's
		// docblock, and it is worth pinning as a *structural* claim rather than as a
		// preference. A `clearSignOutNavigation` is the obvious thing for a failed sign-out
		// to call, and adding one would quietly break the guarantee: every route to
		// `status === "signed-out"` in this app is a sign-out, so a leftover note can only
		// ever be honoured by a genuine one — while a note cleared on failure is a note that
		// will not fire in the case where the session *did* go, which is the case the reader
		// most needs to be sent onward from.
		//
		// Asserted against the export list rather than by calling something absent, so the
		// test fails by name when a clearer is added instead of by not being able to find it.
		const exported = Object.keys(await import("./sign-out-intent")).sort();
		expect(exported).toEqual([
			"requestSignOutNavigation",
			"takeSignOutNavigation",
		]);
	});

	test("keeps the last request when two arrive", () => {
		// Two trees can both be mid-sign-out — the merchant sheet and the shared `/account`
		// hub, which every tree reaches. One note is enough: the destination is the same for
		// both, and the second write overwrites the first rather than queueing a second
		// navigation the gate would have to answer.
		requestSignOutNavigation("authenticate");
		requestSignOutNavigation("authenticate");
		expect(takeSignOutNavigation()).toBe("authenticate");
		expect(takeSignOutNavigation()).toBeNull();
	});
});

import { describe, expect, test } from "bun:test";

import { type PaletteRole, selectTree } from "./select";

/**
 * The palette rule, tested as the rule rather than as a rendered screen.
 *
 * Every case below is a defect that shipped, or a regression that nearly did. `selectTree` is in
 * its own file precisely so this can import it with nothing else: `./tokens` reaches
 * `react-native` for `Platform`, and no test in this repo loads `react-native`, so a rule that
 * returned a palette object could only be tested behind a mock. It returns a name instead, and a
 * name needs no runtime.
 */

const BUSINESS_SEGMENTS = ["(business)", "business"];
const AUTH_SEGMENTS = ["(auth)", "sign-in"];

describe("selectTree", () => {
	describe("the business tree, by segment", () => {
		test("a merchant route is the merchant palette whatever the role says", () => {
			// The segment clause is checked first on purpose. `app/account.tsx:462-472`
			// persists the new profile and only then redirects, so for the length of that hop
			// the reader is still standing in the old tree with the new role already resolved.
			// Role first would repaint the tree being left.
			expect(
				selectTree({ segments: BUSINESS_SEGMENTS, role: "customer" }),
			).toBe("business");
		});

		test("a managed tab is the merchant palette", () => {
			expect(
				selectTree({ segments: ["(business)", "analytics"], role: null }),
			).toBe("business");
		});

		test("a nested route keeps the group as its first segment", () => {
			expect(
				selectTree({
					segments: ["(business)", "merchant-order", "[id]"],
					role: null,
				}),
			).toBe("business");
		});
	});

	describe("the five root routes a merchant pushes", () => {
		// All three trees reach these, which is why they sit at `app/` and why their first
		// segment is never `(business)`. Before the role clause existed, every one of them
		// painted consumer-blue inside the merchant console.
		const ROOT_ROUTES: Array<[string, string[]]> = [
			["/profile", ["profile"]],
			["/settings", ["settings"]],
			["/help", ["help"]],
			["/inbox", ["inbox"]],
			["/new-business", ["new-business"]],
		];

		for (const [route, segments] of ROOT_ROUTES) {
			test(`${route} is the merchant palette for a merchant`, () => {
				expect(selectTree({ segments, role: "business" })).toBe("business");
			});

			test(`${route} stays the consumer palette for a customer`, () => {
				expect(selectTree({ segments, role: "customer" })).toBe("consumer");
			});
		}
	});

	describe("the boot frame", () => {
		// `useSegments()` is `useRouteInfo().segments`, and expo-router's
		// `getRouteInfoFromState` returns `[]` for the whole window before a navigation state
		// exists. `app/index.tsx` is a root route, so this is the frame the ultramarine
		// `#3538f2` spinner was drawn in, for as long as `users.me` took to answer.
		test("an empty segment list with a business preference is the merchant palette", () => {
			expect(selectTree({ segments: [], role: "business" })).toBe("business");
		});

		test("an empty segment list with no role yet is the consumer palette", () => {
			// A fresh install resolves `preference` to `"customer"`, so `null` here is the
			// signed-out cold start, and it must not claim a merchant palette it has not got.
			expect(selectTree({ segments: [], role: null })).toBe("consumer");
		});
	});

	describe("the auth tree, which no role may colour", () => {
		// `lib/role.ts`'s signed-out branch keeps the preference across a sign-out on purpose,
		// so a merchant who signs out is holding `preference === "business"` while looking at the
		// sign-in form. Without this clause they get a white, lime-accented password field.
		for (const role of [
			"business",
			"customer",
			"delivery",
			null,
		] as PaletteRole[]) {
			test(`sign-in is the consumer palette with role ${String(role)}`, () => {
				expect(selectTree({ segments: AUTH_SEGMENTS, role })).toBe("consumer");
			});
		}
	});

	describe("delivery, which is the consumer palette and needs no clause of its own", () => {
		test("a courier route is the consumer palette", () => {
			expect(
				selectTree({
					segments: ["(delivery)", "delivery", "[id]"],
					role: "delivery",
				}),
			).toBe("consumer");
		});

		test("a courier on a root route is the consumer palette", () => {
			expect(selectTree({ segments: ["profile"], role: "delivery" })).toBe(
				"consumer",
			);
		});
	});

	describe("the customer tree", () => {
		test("an ordinary customer route is the consumer palette", () => {
			expect(
				selectTree({ segments: ["(customer)", "index"], role: "customer" }),
			).toBe("consumer");
		});

		test("a customer who also owns a shop draws the customer palette", () => {
			// Entitlement is the server's and `lib/role.ts` decides navigation from the stored
			// preference, so this is the combination the app actually runs in: a customer
			// preference over a business membership stays on the shopping side.
			expect(
				selectTree({ segments: ["(customer)", "index"], role: "customer" }),
			).toBe("consumer");
		});
	});
});

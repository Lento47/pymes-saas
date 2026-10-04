import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The checkout retry contract.
 *
 * `orders.place` is idempotent on `clientRequestId`: the same id twice returns the
 * order that already exists rather than placing a second one. That only works if
 * the id changes exactly once per *attempt* - and an attempt ends on failure just
 * as surely as on success.
 *
 * The bug this pins: `requestId.current` was cleared in `onSuccess` only. After a
 * failed placement the ref kept its value, `submit()`'s `??=` reused it, and the
 * next tap re-sent an already-spent id. The server had taken a claim on that id
 * before its write batch, so it answered `ConflictError` - "tu pedido anterior no
 * terminó de registrarse" - a misleading error about a previous order instead of
 * a clean retry. See `packages/trpc-api/src/services/orders.ts:387` for the claim
 * and `:602-606` for the contract it expects the client to honour.
 *
 * These are assertions on the screen's source rather than on a rendered
 * interaction, which is the convention the other screen-level tests in this
 * directory follow. They pin the *contract* - both terminal handlers exist and
 * clear the ref, and `submit()` still reuses within one attempt. They do not
 * prove React's mutation lifecycle; that is covered by the manual pass in the
 * plan's verification section.
 */
const checkout = readFileSync(
	join(import.meta.dir, "..", "app", "(customer)", "checkout.tsx"),
	"utf8",
);

/** The `useMutation` block for `orders.place`, so the other handlers cannot satisfy these. */
const placeMutation = checkout
	.split("const place = useMutation(")[1]
	?.split("\n\tconst selectedAddress")[0];

describe("checkout retry contract", () => {
	test("the place mutation is readable for these assertions", () => {
		expect(placeMutation).toBeDefined();
		expect(placeMutation).toContain("orders.place.mutationOptions");
	});

	test("a failed attempt clears the id, so the next tap is a new attempt", () => {
		// The half that was missing. Without it the retry re-sends a spent id.
		expect(placeMutation).toContain("onError:");
		// ...and it clears the same ref `submit()` reads, rather than a lookalike.
		const onError = placeMutation?.split("onError:")[1];
		expect(onError).toContain("requestId.current = null;");
	});

	test("a successful attempt still clears the id", () => {
		const onSuccess = placeMutation
			?.split("onSuccess:")[1]
			?.split("onError:")[0];
		expect(onSuccess).toContain("requestId.current = null;");
	});

	test("both terminal handlers clear the id - exactly twice in the mutation", () => {
		const clears = placeMutation?.match(/requestId\.current = null;/g) ?? [];
		expect(clears).toHaveLength(2);
	});

	test("submit still reuses one id per attempt, so a double tap is one order", () => {
		// The counterweight to the fix above. Clearing on error must not become
		// regenerating on every tap: `??=` is what keeps an in-flight retry idempotent,
		// and losing it would turn a double tap into two orders.
		expect(checkout).toContain("requestId.current ??= newClientRequestId();");
		expect(checkout).toContain("clientRequestId: requestId.current,");
	});

	test("the id is never minted inside submit's guard, which would break a double tap", () => {
		// `if (place.isPending || !quote.data) return;` must come first, so the second
		// tap of a double tap is dropped rather than sending a second order.
		const submit = checkout.split("function submit()")[1]?.split("\n\t}")[0];
		expect(submit?.indexOf("place.isPending")).toBeLessThan(
			submit?.indexOf("??=") ?? -1,
		);
	});
});

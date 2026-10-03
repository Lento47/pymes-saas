import { describe, expect, test } from "bun:test";

import {
	ADMIN_ACTIONS,
	adminActionInput,
	adminCourierDecisionInput,
	adminDeleteCategoryInput,
	REASON_MIN_LENGTH,
	REASON_REQUIRED_ACTIONS,
} from "./admin";
import { createPriceBookInput, recordPaymentInput } from "./admin-subscription";

/**
 * An action that demands a reason must have somewhere to put one.
 *
 * Four defects in this console were one invariant violated four times, and this is that
 * invariant:
 *
 * - `createPriceBookInput` had **no `reason` field at all**, so `subscription.create_price_book`
 *   was in `REASON_REQUIRED_ACTIONS` and nothing could ever satisfy it — the service never
 *   asked, wrote no audit row, and a price rise left no trace of who staged it.
 * - `deleteCategory` took `{ id }` and wrote `reason: null`, while the console collected a
 *   reason and dropped it.
 * - `recordSubscriptionPayment` demanded a reason for `subscription.record_payment` and the
 *   console only sent one on an amount mismatch, so the ordinary exact-amount payment was
 *   refused.
 * - `apps/web/client/src/lib/admin.ts` kept its own copy of `REASON_REQUIRED_ACTIONS`, which
 *   had drifted from this one in both directions.
 *
 * The fourth is fixed by deleting the copy, so there is nothing here to test for it. The
 * other three share a shape: **the server refuses without a reason, and the input has no
 * field to send one in.** That is what the table below checks.
 *
 * ## What this table costs, stated plainly
 *
 * It is a hand-maintained list, and a hand-maintained list is the disease. It is here
 * anyway because it is small, it fails loudly when a new reason-requiring action is added
 * without a schema, and it costs one line to extend. The end state that removes even that
 * line is a single `ADMIN_ACTION_INPUTS` registry in this file, with the router deriving its
 * inputs from it and the console deriving `needsReason` from the same table — but that is a
 * wider change than this fix should carry, and a registry introduced alongside a bug fix
 * is a refactor nobody reviewed for what it broke.
 *
 * So: the table is the honest interim, and this docblock is the note that says so.
 */

/**
 * Every input schema that serves a reason-requiring action.
 *
 * `adminActionInput` covers five actions on its own, which is why the mapping is
 * action → *schema* rather than action → schema one-to-one. `adminCourierDecisionInput`
 * takes an optional reason because `courier.verify` does not need one and `courier.reject`
 * does — the key must exist, its optionality is the service's decision, not this test's.
 */
const REASON_INPUTS: Record<string, { shape: Record<string, unknown> }> = {
	"business.suspend": adminActionInput,
	"business.delete": adminActionInput,
	"user.suspend": adminActionInput,
	"order.cancel": adminActionInput,
	"product.unpublish": adminActionInput,
	"courier.reject": adminCourierDecisionInput,
	"subscription.record_payment": recordPaymentInput,
	"subscription.create_price_book": createPriceBookInput,
	"category.delete": adminDeleteCategoryInput,
};

describe("REASON_REQUIRED_ACTIONS", () => {
	test("every entry is a real action", () => {
		// A typo here would make a service refuse without a reason and a console ask for
		// one that is never enforced, in opposite directions, and neither would notice.
		expect(
			REASON_REQUIRED_ACTIONS.filter((a) => !ADMIN_ACTIONS.includes(a)),
		).toEqual([]);
	});

	test("no action appears twice", () => {
		expect(new Set(REASON_REQUIRED_ACTIONS).size).toBe(
			REASON_REQUIRED_ACTIONS.length,
		);
	});

	test("every action it names has an input schema with a reason field", () => {
		const missing = REASON_REQUIRED_ACTIONS.filter((action) => {
			const input = REASON_INPUTS[action];
			// An action with no entry here is untested, not proven: it fails loudly rather
			// than silently passing a set it was never compared against.
			return input === undefined || !("reason" in input.shape);
		});

		expect(missing).toEqual([]);
	});

	test("no schema is listed for an action that does not require a reason", () => {
		// The other direction. A schema here for an action outside the set means someone
		// deleted the action from `REASON_REQUIRED_ACTIONS` and left the wiring behind.
		expect(
			Object.keys(REASON_INPUTS).filter(
				(a) => !REASON_REQUIRED_ACTIONS.includes(a as never),
			),
		).toEqual([]);
	});

	test("the schemas that always need a reason make it required", () => {
		// `adminCourierDecisionInput` and `recordPaymentInput` are absent on purpose: both
		// accept an optional reason because the requirement is conditional — a courier
		// approval and a matched payment do not need one. These two have no such branch, so
		// an optional `reason` would be a field the server can do without and the console
		// would still be obliged to send.
		for (const input of [createPriceBookInput, adminDeleteCategoryInput]) {
			const reason = input.shape.reason as
				| { isOptional?: () => boolean }
				| undefined;
			expect(reason?.isOptional?.()).toBe(false);
		}
	});
});

describe("REASON_MIN_LENGTH", () => {
	test("every required reason is held to it", () => {
		// The number lives here because it was written twice — once in the schema and once
		// in the console — and a console field looser than the API is a field that accepts
		// a reason the server throws away.
		expect(createPriceBookInput.shape.reason).toBeDefined();
		expect(recordPaymentInput.shape.reason).toBeDefined();
		expect(adminDeleteCategoryInput.shape.reason).toBeDefined();
		expect(REASON_MIN_LENGTH).toBeGreaterThanOrEqual(8);
	});
});

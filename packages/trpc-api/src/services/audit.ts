import { auditLog as auditLogTable } from "@pymeshub/db";
import {
	type AdminAction,
	newId,
	REASON_REQUIRED_ACTIONS,
} from "@pymeshub/shared";

import { ValidationError } from "../errors";
import type { UserContext } from "./helpers";

/**
 * The audit write and the reason gate, in one place.
 *
 * **This file exists because two services needed both and only one had them.**
 * `auditStatement` and `requireReason` were private to `services/admin.ts`, where twelve
 * call sites used them. `services/subscription.ts` then had to stage a price rise without
 * either — and `createPriceBook` wrote its row and no record of it, even though
 * `subscription.create_price_book` is in `ADMIN_ACTIONS` and in `REASON_REQUIRED_ACTIONS`.
 * A price rise is the single most consequential operator action on the platform, and it
 * was the one action nobody could name a performer for six months later.
 *
 * So the two helpers move here rather than being copied, and the rule they encode is
 * stated once:
 *
 * - **Every mutation writes an `audit_log` row**, in the same `db.batch` as the change it
 *   describes. A suspension nobody can explain six months later is a suspension that gets
 *   reverted by whoever shouts loudest, and an audit row written in a second statement is
 *   an audit row that can go missing exactly when the change did not.
 * - **A reason is required where a real person loses something** — their storefront, their
 *   account, an order, a payment. `REASON_REQUIRED_ACTIONS` names those, and both sides of
 *   the wire read that one list: the service refuses without it, and the console asks
 *   before sending.
 */

/**
 * One audit row, as a statement the caller can put in a `batch`.
 *
 * Returning the statement rather than awaiting it is the whole point: the change and
 * the record of the change are then one atomic unit. An `await` here followed by the
 * update would leave a window where the platform suspended a business and has no
 * idea who did it.
 */
export function auditStatement(
	ctx: UserContext,
	input: {
		action: AdminAction;
		targetType: string;
		targetId: string;
		before: unknown;
		after: unknown;
		reason: string | null;
		/** Carried by `subscription.record_payment`: the reference the operator got back. */
		reference?: string;
		now: Date;
	},
) {
	return ctx.db.insert(auditLogTable).values({
		id: newId("auditLog"),
		actorUserId: ctx.user.id,
		action: input.action,
		targetType: input.targetType,
		targetId: input.targetId,
		meta: {
			before: input.before,
			after: input.after,
			reason: input.reason,
			...(input.reference === undefined ? {} : { reference: input.reference }),
		},
		createdAt: input.now,
	});
}

/**
 * The reason an action cannot proceed without.
 *
 * Driven by `REASON_REQUIRED_ACTIONS` rather than by a list repeated here, so an
 * action added to that set is enforced the moment it is named — and the *message*
 * matters as much as the check: an operator who is refused needs to know which field
 * they left blank.
 *
 * Call this even where the input schema already makes `reason` required. The schema
 * guards the wire; this guards the service, which is reachable directly by anything
 * holding a `UserContext` — a router, a script, or the next service that needs it.
 */
export function requireReason(
	action: AdminAction,
	reason: string | undefined,
): string {
	if (!reason || reason.trim().length === 0) {
		if (REASON_REQUIRED_ACTIONS.includes(action)) {
			throw new ValidationError("Esta acción requiere un motivo", { action });
		}
		return "";
	}
	return reason;
}

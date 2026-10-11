/**
 * Labels and grouping for the merchant audit log.
 *
 * The feed is a dashboard of rows from `business.auditHistory`. Action names arrive as
 * `LOCATION_PAUSED` or `business.suspend`; the list prints a sentence, and an unknown
 * token is spaced rather than shown raw. Days follow Costa Rica wall time, the same clock
 * the pulse and analytics already use.
 */
import type { MessageKey } from "@pymeshub/i18n";
import { marketDayKey } from "@pymeshub/shared";

export const AUDIT_ACTION_KEYS = {
	LOCATION_PAUSED: "biz.auditHistory.action.locationPaused",
	LOCATION_RESUMED: "biz.auditHistory.action.locationResumed",
	"business.suspend": "biz.auditHistory.action.businessSuspend",
	"business.reactivate": "biz.auditHistory.action.businessReactivate",
	"business.verify": "biz.auditHistory.action.businessVerify",
	"business.delete": "biz.auditHistory.action.businessDelete",
	"user.suspend": "biz.auditHistory.action.userSuspend",
	"user.reactivate": "biz.auditHistory.action.userReactivate",
	"user.grant_admin": "biz.auditHistory.action.userGrantAdmin",
	"user.revoke_admin": "biz.auditHistory.action.userRevokeAdmin",
	"order.cancel": "biz.auditHistory.action.orderCancel",
	"order.refund": "biz.auditHistory.action.orderRefund",
	"product.unpublish": "biz.auditHistory.action.productUnpublish",
	"subscription.record_payment":
		"biz.auditHistory.action.subscriptionRecordPayment",
	"subscription.create_price_book":
		"biz.auditHistory.action.subscriptionCreatePriceBook",
	SUBSCRIPTION_PLAN_CHANGED: "biz.auditHistory.action.subscriptionPlanChanged",
	"category.create": "biz.auditHistory.action.categoryCreate",
	"category.update": "biz.auditHistory.action.categoryUpdate",
	"category.delete": "biz.auditHistory.action.categoryDelete",
	"courier.verify": "biz.auditHistory.action.courierVerify",
	"courier.reject": "biz.auditHistory.action.courierReject",
	"support.reply": "biz.auditHistory.action.supportReply",
	"support.resolve": "biz.auditHistory.action.supportResolve",
	"crash.report": "biz.auditHistory.action.crashReport",
	"crash.resolve": "biz.auditHistory.action.crashResolve",
} as const satisfies Record<string, MessageKey>;

export const AUDIT_TARGET_KEYS = {
	business: "biz.auditHistory.target.business",
	merchant_location: "biz.auditHistory.target.location",
	subscription: "biz.auditHistory.target.subscription",
	order: "biz.auditHistory.target.order",
	user: "biz.auditHistory.target.user",
	product: "biz.auditHistory.target.product",
	category: "biz.auditHistory.target.category",
	courier: "biz.auditHistory.target.courier",
	support_ticket: "biz.auditHistory.target.ticket",
	crash_report: "biz.auditHistory.target.crash",
} as const satisfies Record<string, MessageKey>;

export function auditActionKey(action: string): MessageKey | undefined {
	return AUDIT_ACTION_KEYS[action as keyof typeof AUDIT_ACTION_KEYS];
}

export function auditTargetKey(targetType: string): MessageKey | undefined {
	return AUDIT_TARGET_KEYS[targetType as keyof typeof AUDIT_TARGET_KEYS];
}

/** `LOCATION_PAUSED` → `Location paused`, `business.suspend` → `Business suspend`. */
export function prettifyAuditToken(value: string): string {
	const spaced = value.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
	if (!spaced) return value;
	return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function groupAuditEntriesByDay<T extends { createdAt: Date }>(
	entries: T[],
): { key: string; date: Date; entries: T[] }[] {
	const groups: { key: string; date: Date; entries: T[] }[] = [];
	const index = new Map<string, number>();
	for (const entry of entries) {
		const key = marketDayKey(entry.createdAt);
		const existing = index.get(key);
		if (existing === undefined) {
			index.set(key, groups.length);
			groups.push({ key, date: entry.createdAt, entries: [entry] });
		} else {
			groups[existing]?.entries.push(entry);
		}
	}
	return groups;
}

export function formatAuditValue(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length === 0 ? null : trimmed;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	try {
		const printed = JSON.stringify(value, null, 2);
		return printed && printed !== "null" ? printed : null;
	} catch {
		return null;
	}
}

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	AUDIT_ACTION_KEYS,
	auditActionKey,
	auditTargetKey,
	formatAuditValue,
	groupAuditEntriesByDay,
	prettifyAuditToken,
} from "./audit-history";

const screen = readFileSync(
	join(import.meta.dir, "..", "app", "(business)", "audit-history.tsx"),
	"utf8",
);
const en = readFileSync(
	join(
		import.meta.dir,
		"..",
		"..",
		"..",
		"packages",
		"i18n",
		"src",
		"messages",
		"en",
		"business.ts",
	),
	"utf8",
);

describe("merchant audit log helpers", () => {
	test("known actions and targets map to i18n keys", () => {
		expect(auditActionKey("LOCATION_PAUSED")).toBe(
			"biz.auditHistory.action.locationPaused",
		);
		expect(auditActionKey("business.suspend")).toBe(
			"biz.auditHistory.action.businessSuspend",
		);
		expect(auditActionKey("SUBSCRIPTION_PLAN_CHANGED")).toBe(
			"biz.auditHistory.action.subscriptionPlanChanged",
		);
		expect(auditActionKey("future.action")).toBeUndefined();
		expect(auditTargetKey("merchant_location")).toBe(
			"biz.auditHistory.target.location",
		);
		expect(auditTargetKey("order")).toBe("biz.auditHistory.target.order");
		expect(Object.keys(AUDIT_ACTION_KEYS).length).toBeGreaterThan(20);
	});

	test("unknown tokens become a sentence, not a raw machine name", () => {
		expect(prettifyAuditToken("LOCATION_PAUSED")).toBe("Location paused");
		expect(prettifyAuditToken("business.suspend")).toBe("Business suspend");
		expect(prettifyAuditToken("weird__token")).toBe("Weird token");
	});

	test("empty before/after/reason values stay hidden", () => {
		expect(formatAuditValue(null)).toBeNull();
		expect(formatAuditValue("")).toBeNull();
		expect(formatAuditValue("   ")).toBeNull();
		expect(formatAuditValue("paused")).toBe("paused");
		expect(formatAuditValue({ status: "PAUSED" })).toContain("PAUSED");
	});

	test("rows group on the Costa Rica calendar day, newest group first", () => {
		const later = new Date("2026-10-10T06:00:00.000Z");
		const earlierSameDay = new Date("2026-10-10T12:00:00.000Z");
		const previousDay = new Date("2026-10-10T05:59:00.000Z");
		const groups = groupAuditEntriesByDay([
			{ createdAt: later, id: "a" },
			{ createdAt: earlierSameDay, id: "b" },
			{ createdAt: previousDay, id: "c" },
		]);
		expect(groups.map((group) => group.key)).toEqual([
			"2026-10-10",
			"2026-10-09",
		]);
		expect(groups[0]?.entries.map((entry) => entry.id)).toEqual(["a", "b"]);
		expect(groups[1]?.entries.map((entry) => entry.id)).toEqual(["c"]);
	});
});

describe("merchant audit history screen", () => {
	test("the feed is a hairline log, not stacked info cards", () => {
		expect(screen).toContain("ListRow");
		expect(screen).toContain("SectionHeader");
		expect(screen).toContain("AuditDetailSlice");
		expect(screen).toContain("groupAuditEntriesByDay");
		expect(screen).not.toContain("<Sheet");
		expect(screen).not.toContain('from "@/components/sheet"');
		expect(screen).not.toContain('from "@/components/card"');
		expect(screen).not.toContain("AuditEntryCard");
	});

	test("event counts use tp's {count}", () => {
		expect(screen).toContain('tp("biz.auditHistory.events"');
		expect(en).toContain('"biz.auditHistory.events": "{count} change"');
		expect(en).not.toContain("{quantity}");
	});
});

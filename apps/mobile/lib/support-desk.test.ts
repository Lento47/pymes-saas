import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The support desk's three contracts, as they reach the screen.
 *
 * These are assertions on source rather than on a rendered interaction, which is the
 * convention the other screen-level tests in this directory follow (`checkout-retry.test.ts`
 * says why: they pin the contract, not React's mutation lifecycle, and the interactive pass
 * is the plan's manual verification step).
 *
 * Three things are pinned, and each of them was a real way for this screen to be wrong:
 *
 * 1. **The row goes to the desk.** `(business)/account.tsx` and `(business)/menu.tsx` both
 *    rendered `biz.more.support` with `biz.more.supportSubtitle` and pushed *different*
 *    places — this one to `/help`, the customer's four-question FAQ. Two identical-looking
 *    rows opening different screens is what gets reported as "the app is broken".
 * 2. **The `enabled` guard.** `MerchantManagementFrame` resolves a shop with
 *    `find(...) ?? shopList[0]` and falls back to `""`; `businessProcedure("orders:read")`
 *    refuses that id at the middleware, so an ungated query is a guaranteed error rather
 *    than an empty desk.
 * 3. **The create payload's bounds.** `supportTicketCreateInput` caps `subject` at 120 and
 *    `body` at 2000. A screen that sends a longer one gets a rejection naming no field, and
 *    a screen that sends a shorter `maxLength` than the contract is refusing input the
 *    server would have taken.
 */

const read = (...parts: string[]) =>
	readFileSync(join(import.meta.dir, "..", ...parts), "utf8");

const account = read("app", "(business)", "account.tsx");
const menu = read("app", "(business)", "menu.tsx");
const surfaces = read("components", "merchant-management-surfaces.tsx");
const newTicket = read("app", "(business)", "support", "new.tsx");

/** The `ListRow` carrying `biz.more.support`, so a lookalike row cannot satisfy these. */
const supportRow = (source: string) =>
	source
		.split('title={t("biz.more.support")}')
		?.slice(1)
		.map((after) => after.split("/>")[0])
		.join("");

describe("support desk routes", () => {
	test("both support rows go to the same screen", () => {
		expect(supportRow(account)).toContain('router.push("/(business)/support")');
		expect(supportRow(menu)).toContain('router.push("/(business)/support")');
	});

	test("neither support row goes to the FAQ any more", () => {
		// `/help` is the customer's FAQ and stays a valid screen — the guard is that the
		// *support* row must not reach it, not that `/help` must not exist.
		expect(supportRow(account)).not.toContain("/help");
		expect(supportRow(menu)).not.toContain("/help");
	});

	test("the rows still read identically, which is why they have to agree", () => {
		// If a future edit gives one a different subtitle the two screens stop looking
		// interchangeable to a reader who saw them as the same row. Pinned so that change
		// has to be a decision.
		expect(account).toContain("biz.more.supportSubtitle");
		expect(menu).toContain("biz.more.supportSubtitle");
	});
});

describe("the desk surface queries instead of hardcoding", () => {
	test("it reads the live queue", () => {
		expect(surfaces).toContain("trpc.support.list.queryOptions");
	});

	test("the query is gated on a real business id", () => {
		// The one assertion that would catch the empty-shop case: an ungated
		// `businessId: ""` reaches `businessProcedure` and is refused there.
		const query = surfaces
			.split("trpc.support.list.queryOptions")
			?.slice(1)
			.join("");
		expect(query).toContain("{ enabled: !!scope.businessId }");
	});

	test("it no longer prints the fixed 'no tickets' value", () => {
		// The bug: `value={t("biz.manage.noTickets")}` was a constant, so a shop with five
		// open tickets was told it had none.
		expect(surfaces).not.toContain('value={t("biz.manage.noTickets")}');
	});

	test("the padding KeyValue is gone", () => {
		// Label read "App guidance", value read "Support". Stated nothing about anything.
		const surface = surfaces.split("function SupportSurface")[1] ?? "";
		expect(surface).not.toContain("biz.manage.responseChannel");
	});
});

describe("opening a ticket", () => {
	test("it posts the contract's own mutation", () => {
		expect(newTicket).toContain("trpc.support.create.mutationOptions");
	});

	test("subject and body are capped where the contract caps them", () => {
		// `supportTicketCreateInput` is `.max(120)` and `.max(2000)`. A `maxLength`
		// *below* the contract refuses input the server would have accepted, which is a
		// bug the reader experiences as "it won't let me finish my question".
		expect(newTicket).toContain("const SUBJECT_MAX = 120;");
		expect(newTicket).toContain("const BODY_MAX = 2000;");
		expect(newTicket).toContain("maxLength={SUBJECT_MAX}");
		expect(newTicket).toContain("maxLength={BODY_MAX}");
	});

	test("both ceilings are drawn as counters, so the number shown is the number enforced", () => {
		// `Field`'s `counter` reads its `maxLength`. Without it the reader has no way to
		// know the field is bounded and hits a silent stop. Counted as the JSX prop
		// `\n\t\t\t\t\tcounter` rather than as the bare word, because this file's own prose
		// about counters is in the same string and would be counted too.
		const counters = newTicket.match(/\n\s+counter\n/g) ?? [];
		expect(counters.length).toBe(2);
	});

	test("the category comes from the contract's own list", () => {
		// Hand-writing five options is how the screen and `TICKET_CATEGORY` drift, and a
		// sixth category would then be unreachable from the phone.
		expect(newTicket).toContain("TICKET_CATEGORY.map");
	});

	test("it cannot submit without a shop, because the middleware would refuse it", () => {
		expect(newTicket).toContain("!businessId");
	});
});

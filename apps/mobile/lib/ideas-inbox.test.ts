import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The ideas inbox's doors, as they reach the screen.
 *
 * Any signed-in person can send an idea, so the row has to exist on the customer
 * hub, the courier hub, and the merchant desk — three trees that otherwise share
 * nothing. A door missing from one of them is a persona that cannot speak.
 */

const read = (...parts: string[]) =>
	readFileSync(join(import.meta.dir, "..", ...parts), "utf8");

const account = read("app", "account.tsx");
const courier = read("app", "(delivery)", "account.tsx");
const settings = read("app", "settings.tsx");
const help = read("app", "help.tsx");
const surfaces = read("components", "merchant-management-surfaces.tsx");
const list = read("app", "ideas.tsx");
const form = read("app", "ideas", "new.tsx");

describe("ideas doors", () => {
	test("the customer, courier and settings hubs open the same inbox", () => {
		expect(account).toContain('router.push("/ideas" as Href)');
		expect(courier).toContain('router.push("/ideas" as Href)');
		expect(settings).toContain('router.push("/ideas")');
		expect(help).toContain('router.push("/ideas")');
	});

	test("the merchant desk opens the same inbox, not a second shop-scoped one", () => {
		const surface = surfaces.split("function SupportSurface")[1] ?? "";
		expect(surface).toContain('router.push("/ideas")');
	});
});

describe("sending an idea", () => {
	test("it posts the contract's own mutation", () => {
		expect(form).toContain("trpc.idea.create.mutationOptions");
	});

	test("subject and body are capped where the contract caps them", () => {
		expect(form).toContain("const SUBJECT_MAX = 120;");
		expect(form).toContain("const BODY_MAX = 2000;");
		expect(form).toContain("maxLength={SUBJECT_MAX}");
		expect(form).toContain("maxLength={BODY_MAX}");
	});

	test("the list reads the submitter's own rows", () => {
		expect(list).toContain("trpc.idea.listMine.queryOptions");
	});

	test("the description opens under the row, one idea at a time", () => {
		expect(list).toContain("setOpenId");
		expect(list).toContain("IdeaBodySlice");
		expect(list).toContain("chevron-down");
		expect(list).not.toContain("subtitle={row.body}");
	});
});

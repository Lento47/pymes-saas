import { describe, expect, test } from "bun:test";

import { category as categoryTable } from "@pymeshub/db";
import type { BusinessCreateInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import { authed, refused, seedUser, type TestWorld, world } from "./harness";

/**
 * A shop is filed under a leaf, or not at all.
 *
 * The taxonomy is two levels, and `businesses.list` already reads a sector as "this sector
 * and the categories under it" (`services/helpers.ts`, `inCategory`). A shop filed on the
 * sector itself would therefore answer for every child it has nothing to do with — which is
 * why `businesses.ts`'s `assertLeafCategory` refuses a row with no parent, a row the
 * platform has deactivated, and an id that names no row at all.
 *
 * `businessCreateInput.categoryId` is the other half and the two failures are different
 * ones: zod refuses a *missing* id before the resolver runs (a tRPC `BAD_REQUEST`, no
 * `DomainError` behind it), and `assertLeafCategory` refuses an id that is present and
 * unusable (a `ValidationError`, which the `errorFormatter` republishes as `BAD_REQUEST`).
 * This file holds both, because "required" and "valid" are not the same rule.
 *
 * The foreign key on `business.category_id` does not cover the second half: a sector
 * satisfies it exactly as well as a leaf does.
 */

type Caller = ReturnType<typeof appRouter.createCaller>;

/** A signed-in caller, since `business.create` is a `protectedProcedure`. */
async function signedIn(test: TestWorld, userId: string): Promise<Caller> {
	const user = await seedUser(test.db, { id: userId });
	return appRouter.createCaller(await authed(test, user)) as Caller;
}

/**
 * The fields `businessCreateInput` has no default for. Everything else on the schema —
 * country, currency, the delivery switches, the three minimums — is left alone.
 */
const REQUIRED = {
	name: "Tienda Bizcat",
	line1: "Avenida 1, 100 metros norte del parque",
	city: "Ciudad",
	region: "Provincia",
};

/**
 * The payload a client sends when nothing is chosen — the key is simply absent.
 *
 * The cast is the test rather than a way around it: `BusinessCreateInput` *requires*
 * `categoryId` now, so a payload without one cannot be written as that type. Asserting that the
 * API refuses it is asserting the rule, and the rule is what a client that omits the field
 * meets.
 */
const CHOOSELESS = { ...REQUIRED } as unknown as BusinessCreateInput;

/**
 * This file's own taxonomy: a sector, an active leaf under it, a deactivated leaf, and an
 * id that is never inserted (`cat_bizcat_ghost`, named only in the tests below).
 */
async function taxonomy(test: TestWorld): Promise<void> {
	await test.db.insert(categoryTable).values([
		{
			id: "cat_bizcat_sector",
			slug: "bizcat-sector",
			name: "Sector Bizcat",
			sortOrder: 300,
		},
		{
			id: "cat_bizcat_leaf",
			slug: "bizcat-leaf",
			name: "Hoja Bizcat",
			parentId: "cat_bizcat_sector",
			sortOrder: 301,
		},
		{
			id: "cat_bizcat_off",
			slug: "bizcat-off",
			name: "Hoja Apagada Bizcat",
			parentId: "cat_bizcat_sector",
			isActive: false,
			sortOrder: 302,
		},
	]);
}

describe("a business may only be filed under a leaf", () => {
	test("an input with no categoryId at all is refused", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const caller = await signedIn(test, "usr_bizcat_none");

			// tRPC parses the input before any resolver runs, so this refusal is tRPC's own
			// `BAD_REQUEST` and carries no `DomainError` for `refused()` to unwrap: the code is
			// read off the thrown error itself.
			await expect(caller.business.create(CHOOSELESS)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		} finally {
			test.close();
		}
	});

	test("a sector id is refused", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const caller = await signedIn(test, "usr_bizcat_sector");

			const error = await refused(
				caller.business.create({
					...REQUIRED,
					categoryId: "cat_bizcat_sector",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");
		} finally {
			test.close();
		}
	});

	test("a deactivated category is refused", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const caller = await signedIn(test, "usr_bizcat_off");

			const error = await refused(
				caller.business.create({
					...REQUIRED,
					categoryId: "cat_bizcat_off",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");
		} finally {
			test.close();
		}
	});

	test("an id that names no row is refused", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const caller = await signedIn(test, "usr_bizcat_ghost");

			const error = await refused(
				caller.business.create({
					...REQUIRED,
					categoryId: "cat_bizcat_ghost",
				}),
			);
			expect(error.code).toBe("BAD_REQUEST");
		} finally {
			test.close();
		}
	});

	test("an active leaf is accepted, and the settings carry it back", async () => {
		const test = world();
		try {
			await taxonomy(test);
			const caller = await signedIn(test, "usr_bizcat_ok");

			const settings = await caller.business.create({
				...REQUIRED,
				categoryId: "cat_bizcat_leaf",
			});

			expect(settings.categoryId).toBe("cat_bizcat_leaf");
		} finally {
			test.close();
		}
	});
});

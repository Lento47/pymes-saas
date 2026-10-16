import { describe, expect, test } from "bun:test";
import { auditLog, mobileConfigurationRevision, user } from "@pymeshub/db";
import { DEFAULT_MOBILE_CONFIGURATION } from "@pymeshub/shared";
import { eq } from "drizzle-orm";
import { appRouter } from "../src/routers";
import { requireMobileAction } from "../src/services/mobile-configuration";
import {
	authed,
	refused,
	seedBusiness,
	seedProduct,
	seedUser,
	world,
} from "./harness";

async function fixture() {
	const w = world();
	const admin = await seedUser(w.db, {
		id: "usr_mobile_editor",
		isAdmin: true,
	});
	const superAdmin = await seedUser(w.db, {
		id: "usr_mobile_publisher",
		isAdmin: true,
	});
	await w.db
		.update(user)
		.set({ canPublishMobile: true })
		.where(eq(user.id, superAdmin.id));
	const adminContext = await authed(w, admin);
	const publisherContext = await authed(w, superAdmin);
	const editor = appRouter.createCaller(adminContext);
	const publisher = appRouter.createCaller(publisherContext);
	const anonymous = appRouter.createCaller({
		...adminContext,
		user: null,
		auth: null,
		memberships: [],
	});
	return {
		w,
		admin,
		superAdmin,
		adminContext,
		publisherContext,
		editor,
		publisher,
		anonymous,
	};
}
const configuration = {
	...DEFAULT_MOBILE_CONFIGURATION,
	visibility: { categories: false },
};

describe("mobile configuration", () => {
	test("only published snapshots are public; general admins may edit but cannot publish or restore", async () => {
		const { w, editor, publisher, anonymous } = await fixture();
		try {
			expect(
				(await anonymous.mobile.published()).configuration.visibility,
			).toEqual({});
			expect((await refused(anonymous.mobile.draft())).code).toBe(
				"UNAUTHORIZED",
			);
			await editor.mobile.saveDraft({ expectedVersion: 0, configuration });
			expect(
				(await anonymous.mobile.published()).configuration.visibility,
			).toEqual({});
			expect(
				(
					await refused(
						editor.mobile.publish({
							expectedVersion: 1,
							reason: "Hide category browsing",
						}),
					)
				).code,
			).toBe("FORBIDDEN");
			const result = await publisher.mobile.publish({
				expectedVersion: 1,
				reason: "Hide category browsing",
			});
			expect(result.draft).toBeNull();
			expect(result.published.revision).toBe(1);
			expect((await anonymous.mobile.published()).configuration).toEqual(
				configuration,
			);
			expect(await anonymous.mobile.published()).not.toHaveProperty("draft");
			expect(
				(
					await refused(
						editor.mobile.restore({
							revisionId: result.published.revisionId ?? "",
							expectedVersion: 2,
							reason: "Restore previous settings",
						}),
					)
				).code,
			).toBe("FORBIDDEN");
		} finally {
			w.close();
		}
	});
	test("concurrent edits and publications cannot overwrite a newer draft or duplicate history", async () => {
		const { w, editor, publisher } = await fixture();
		try {
			const results = await Promise.allSettled([
				editor.mobile.saveDraft({ expectedVersion: 0, configuration }),
				editor.mobile.saveDraft({
					expectedVersion: 0,
					configuration: DEFAULT_MOBILE_CONFIGURATION,
				}),
			]);
			expect(
				results.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			expect((await editor.mobile.draft()).version).toBe(1);
			const publications = await Promise.allSettled([
				publisher.mobile.publish({
					expectedVersion: 1,
					reason: "First publisher",
				}),
				publisher.mobile.publish({
					expectedVersion: 1,
					reason: "Second publisher",
				}),
			]);
			expect(
				publications.filter((result) => result.status === "fulfilled"),
			).toHaveLength(1);
			expect((await publisher.mobile.history({})).items).toHaveLength(1);
			expect(
				await w.db
					.select()
					.from(auditLog)
					.where(eq(auditLog.action, "mobile.publish")),
			).toHaveLength(1);
			expect(
				await w.db
					.select()
					.from(auditLog)
					.where(eq(auditLog.action, "mobile.draft")),
			).toHaveLength(1);
		} finally {
			w.close();
		}
	});
	test("restore creates an immutable audited revision, and discard leaves the published snapshot intact", async () => {
		const { w, editor, publisher, anonymous } = await fixture();
		try {
			await editor.mobile.saveDraft({ expectedVersion: 0, configuration });
			const first = await publisher.mobile.publish({
				expectedVersion: 1,
				reason: "Initial publication",
			});
			await editor.mobile.saveDraft({
				expectedVersion: 2,
				configuration: DEFAULT_MOBILE_CONFIGURATION,
			});
			await publisher.mobile.publish({
				expectedVersion: 3,
				reason: "Restore all browsing",
			});
			await editor.mobile.saveDraft({ expectedVersion: 4, configuration });
			await editor.mobile.discardDraft({ expectedVersion: 5 });
			expect((await anonymous.mobile.published()).configuration).toEqual(
				DEFAULT_MOBILE_CONFIGURATION,
			);
			await publisher.mobile.restore({
				expectedVersion: 6,
				revisionId: first.published.revisionId ?? "",
				reason: "Return to approved snapshot",
			});
			expect((await anonymous.mobile.published()).revision).toBe(3);
			expect((await anonymous.mobile.published()).configuration).toEqual(
				configuration,
			);
			const history = await publisher.mobile.history({});
			expect(history.items[0]?.restoredFromId).toBe(first.published.revisionId);
			expect(
				await w.db
					.select()
					.from(auditLog)
					.where(eq(auditLog.action, "mobile.restore")),
			).toHaveLength(1);
			await expect(
				w.db
					.delete(mobileConfigurationRevision)
					.where(
						eq(
							mobileConfigurationRevision.id,
							first.published.revisionId ?? "",
						),
					)
					.run(),
			).rejects.toThrow();
		} finally {
			w.close();
		}
	});
	test("a failed audit rolls back publication and preserves the editable draft", async () => {
		const { w, editor, publisher, anonymous } = await fixture();
		try {
			await editor.mobile.saveDraft({ expectedVersion: 0, configuration });
			w.sqlite.exec(
				"CREATE TRIGGER reject_mobile_audit BEFORE INSERT ON audit_log WHEN NEW.action='mobile.publish' BEGIN SELECT RAISE(ABORT, 'test audit failure'); END",
			);
			await expect(
				publisher.mobile.publish({
					expectedVersion: 1,
					reason: "Must roll back",
				}),
			).rejects.toThrow();
			expect((await anonymous.mobile.published()).revision).toBe(0);
			expect((await editor.mobile.draft()).version).toBe(1);
			expect((await editor.mobile.draft()).draft).toEqual(configuration);
		} finally {
			w.close();
		}
	});
	test("mobile availability does not change web behavior and never trusts general admin status as publish permission", async () => {
		const { w, adminContext, editor, publisher, superAdmin } = await fixture();
		try {
			await editor.mobile.saveDraft({
				expectedVersion: 0,
				configuration: {
					...configuration,
					visibility: { "customer.newCheckout": false },
				},
			});
			await publisher.mobile.publish({
				expectedVersion: 1,
				reason: "Pause mobile checkout",
			});
			expect(
				(
					await refused(
						requireMobileAction(
							{ ...adminContext, client: "android" },
							"customer.newCheckout",
						),
					)
				).code,
			).toBe("CONFLICT");
			expect(
				(
					await refused(
						requireMobileAction(
							{ ...adminContext, client: "ios" },
							"customer.newCheckout",
						),
					)
				).code,
			).toBe("CONFLICT");
			await requireMobileAction(
				{ ...adminContext, client: "web" },
				"customer.newCheckout",
			);
			await requireMobileAction(
				{ ...adminContext, client: "unknown" },
				"customer.newCheckout",
			);
			await w.db
				.update(user)
				.set({ canPublishMobile: false })
				.where(eq(user.id, superAdmin.id));
			await editor.mobile.saveDraft({ expectedVersion: 2, configuration });
			expect(
				(
					await refused(
						publisher.mobile.publish({
							expectedVersion: 3,
							reason: "Permission was revoked",
						}),
					)
				).code,
			).toBe("FORBIDDEN");
		} finally {
			w.close();
		}
	});
	test("checkout boundary rejects new mobile orders but preserves completed-request retries, carts and web checkout", async () => {
		const { w, editor, publisher } = await fixture();
		try {
			const businessId = await seedBusiness(w.db);
			const product = await seedProduct(w.db, { businessId });
			const customer = await seedUser(w.db, { id: "usr_mobile_customer" });
			const ctx = await authed(w, customer);
			const web = appRouter.createCaller({ ...ctx, client: "web" });
			const mobile = appRouter.createCaller({ ...ctx, client: "android" });
			await web.cart.addItem({
				productId: product.id,
				quantity: 1,
				optionIds: [],
			});
			const first = await mobile.orders.place({
				fulfilment: "PICKUP",
				paymentMethod: "CASH",
				clientRequestId: "mobile_request_0001",
			});
			await editor.mobile.saveDraft({
				expectedVersion: 0,
				configuration: {
					...configuration,
					visibility: {
						"customer.newCheckout": false,
						"merchant.newOrders": false,
					},
				},
			});
			await publisher.mobile.publish({
				expectedVersion: 1,
				reason: "Pause new mobile activity",
			});
			expect(
				(
					await mobile.orders.place({
						fulfilment: "PICKUP",
						paymentMethod: "CASH",
						clientRequestId: "mobile_request_0001",
					})
				).id,
			).toBe(first.id);
			await web.cart.addItem({
				productId: product.id,
				quantity: 1,
				optionIds: [],
			});
			expect(
				(
					await refused(
						mobile.orders.place({
							fulfilment: "PICKUP",
							paymentMethod: "CASH",
							clientRequestId: "mobile_request_0002",
						}),
					)
				).code,
			).toBe("CONFLICT");
			expect((await mobile.cart.get()).items).toHaveLength(1);
			expect((await mobile.orders.byId({ id: first.id })).id).toBe(first.id);
			expect(
				(
					await web.orders.place({
						fulfilment: "PICKUP",
						paymentMethod: "CASH",
						clientRequestId: "web_request_0002",
					})
				).id,
			).not.toBe(first.id);
		} finally {
			w.close();
		}
	});
});

import { describe, expect, test } from "bun:test";

import { auditLog as auditLogTable } from "@pymeshub/db";
import { businessAuditHistoryInput } from "@pymeshub/shared";

import { appRouter } from "../src/routers";
import {
	authed,
	seedBusiness,
	seedMembership,
	seedUser,
	type TestWorld,
	world,
} from "./harness";

type Caller = ReturnType<typeof appRouter.createCaller>;

async function auditWorld() {
	const test = world();
	const owner = await seedUser(test.db, {
		id: "usr_audit_owner",
		name: "Ana Auditores",
	});
	const businessId = await seedBusiness(test.db, {
		id: "biz_audit_history",
		slug: "negocio-auditoria",
		name: "Negocio Auditoría",
	});
	await seedMembership(test.db, owner.id, businessId, "OWNER");
	const caller = appRouter.createCaller(await authed(test, owner)) as Caller;

	return { businessId, caller, owner, test };
}

async function insertAuditRows(
	test: TestWorld,
	rows: Array<{
		id: string;
		actorUserId?: string | null;
		action: string;
		targetType?: string;
		targetId: string;
		meta?: Record<string, unknown> | null;
		createdAt: Date;
	}>,
) {
	await test.db.insert(auditLogTable).values(
		rows.map((row) => ({
			id: row.id,
			actorUserId: row.actorUserId ?? null,
			action: row.action,
			targetType: row.targetType ?? "business",
			targetId: row.targetId,
			meta: row.meta ?? null,
			createdAt: row.createdAt,
		})),
	);
}

describe("business audit history input", () => {
	test("strips the transport's reserved direction while preserving sortDirection", () => {
		const parsed = businessAuditHistoryInput.parse({
			businessId: "biz_audit_history",
			direction: "forward",
			sortDirection: "asc",
			limit: 20,
		});

		expect(parsed.sortDirection).toBe("asc");
		expect("direction" in parsed).toBe(false);
	});
});

describe("business audit history", () => {
	test("returns descending history newest first", async () => {
		const { businessId, caller, owner, test } = await auditWorld();
		await insertAuditRows(test, [
			{
				id: "aud_oldest",
				actorUserId: owner.id,
				action: "business.updated",
				targetId: businessId,
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
			},
			{
				id: "aud_newest",
				actorUserId: owner.id,
				action: "business.updated",
				targetId: businessId,
				createdAt: new Date("2026-01-03T10:00:00.000Z"),
			},
			{
				id: "aud_middle",
				actorUserId: owner.id,
				action: "business.updated",
				targetId: businessId,
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
			},
		]);

		const page = await caller.business.auditHistory({
			businessId,
			offset: 0,
			limit: 20,
			sortDirection: "desc",
		});

		expect(page.rows.map((row) => row.id)).toEqual([
			"aud_newest",
			"aud_middle",
			"aud_oldest",
		]);
		expect(page.total).toBe(3);
	});

	test("uses the accumulated row count as the next numeric cursor", async () => {
		const { businessId, caller, owner, test } = await auditWorld();
		await insertAuditRows(
			test,
			["aud_one", "aud_two", "aud_three"].map((id, index) => ({
				id,
				actorUserId: owner.id,
				action: "business.updated",
				targetId: businessId,
				createdAt: new Date(Date.UTC(2026, 0, 1, 10, index)),
			})),
		);

		const first = await caller.business.auditHistory({
			businessId,
			offset: 0,
			limit: 2,
			sortDirection: "desc",
		});
		const nextOffset = first.rows.length;
		const second = await caller.business.auditHistory({
			businessId,
			cursor: nextOffset,
			limit: 2,
			sortDirection: "desc",
		});

		expect(nextOffset).toBe(2);
		expect(second.rows.map((row) => row.id)).toEqual(["aud_one"]);
		expect(second.total).toBe(3);
	});

	test("returns the exact audit mapper shape and resolves the actor name", async () => {
		const { businessId, caller, owner, test } = await auditWorld();
		await insertAuditRows(test, [
			{
				id: "aud_shape",
				actorUserId: owner.id,
				action: "merchant_location.created",
				targetType: "business",
				targetId: businessId,
				meta: {
					before: { status: "draft" },
					after: { status: "active" },
					reason: "Verified storefront",
				},
				createdAt: new Date("2026-02-01T12:00:00.000Z"),
			},
		]);

		const page = await caller.business.auditHistory({
			businessId,
			offset: 0,
			limit: 20,
			sortDirection: "desc",
		});
		const entry = page.rows[0];

		expect(entry).toBeDefined();
		expect(Object.keys(entry ?? {}).sort()).toEqual(
			[
				"id",
				"actorId",
				"actorName",
				"action",
				"targetType",
				"targetId",
				"before",
				"after",
				"reason",
				"createdAt",
			].sort(),
		);
		expect(entry).toMatchObject({
			id: "aud_shape",
			actorId: owner.id,
			actorName: "Ana Auditores",
			action: "merchant_location.created",
			targetType: "business",
			targetId: businessId,
			before: { status: "draft" },
			after: { status: "active" },
			reason: "Verified storefront",
		});
		expect(entry?.createdAt).toEqual(new Date("2026-02-01T12:00:00.000Z"));
	});

	test("breaks timestamp ties by id", async () => {
		const { businessId, caller, owner, test } = await auditWorld();
		const createdAt = new Date("2026-03-01T09:00:00.000Z");
		await insertAuditRows(
			test,
			["aud_c", "aud_a", "aud_b"].map((id) => ({
				id,
				actorUserId: owner.id,
				action: "business.updated",
				targetId: businessId,
				createdAt,
			})),
		);

		const page = await caller.business.auditHistory({
			businessId,
			offset: 0,
			limit: 20,
			sortDirection: "desc",
		});

		expect(page.rows.map((row) => row.id)).toEqual(["aud_a", "aud_b", "aud_c"]);
	});
});

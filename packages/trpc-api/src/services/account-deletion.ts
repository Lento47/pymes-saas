import {
	account as accountTable,
	address as addressTable,
	auditLog as auditTable,
	cart as cartTable,
	courierProfile as courierProfileTable,
	type Db,
	favorite as favoriteTable,
	membership as membershipTable,
	notification as notificationTable,
	orderEvent as orderEventTable,
	order as orderTable,
	pushDelivery as pushDeliveryTable,
	accountDeletionRequest as requestTable,
	session as sessionTable,
	devicePushToken as tokenTable,
	upload as uploadTable,
	user as userTable,
	verification as verificationTable,
} from "@pymeshub/db";
import { and, eq, inArray, lte, ne, notInArray, or } from "drizzle-orm";

import { ConflictError } from "../errors";
import type { UserContext } from "./helpers";
import { batchOf } from "./helpers";

const CANCELLATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
const RETRY_BLOCKED_MS = 24 * 60 * 60 * 1_000;
const TERMINAL_STATUSES = ["REJECTED", "COMPLETED", "CANCELLED"] as const;

export type DeletionStatus = {
	status: "SCHEDULED" | "BLOCKED" | "PROCESSING" | "COMPLETED";
	requestedAt: Date;
	scheduledFor: Date;
	completedAt: Date | null;
	lastError: string | null;
};

function statusOf(row: typeof requestTable.$inferSelect): DeletionStatus {
	return {
		status: row.status,
		requestedAt: row.requestedAt,
		scheduledFor: row.scheduledFor,
		completedAt: row.completedAt,
		lastError: row.lastError,
	};
}

async function assertNotLastOwner(db: Db, userId: string): Promise<void> {
	const owned = await db
		.select({ businessId: membershipTable.businessId })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.userId, userId),
				eq(membershipTable.role, "OWNER"),
			),
		);
	for (const membership of owned) {
		const otherOwners = await db
			.select({ userId: membershipTable.userId })
			.from(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, membership.businessId),
					eq(membershipTable.role, "OWNER"),
					ne(membershipTable.userId, userId),
				),
			)
			.limit(1);
		if (otherOwners.length === 0) {
			throw new ConflictError(
				"Transfiere la propiedad de tu negocio antes de eliminar la cuenta",
				{ businessId: membership.businessId },
			);
		}
	}
}

export async function status(ctx: UserContext): Promise<DeletionStatus | null> {
	const rows = await ctx.db
		.select()
		.from(requestTable)
		.where(eq(requestTable.userId, ctx.user.id))
		.limit(1);
	return rows[0] ? statusOf(rows[0]) : null;
}

export async function request(ctx: UserContext): Promise<DeletionStatus> {
	await assertNotLastOwner(ctx.db, ctx.user.id);
	const now = new Date();
	const scheduledFor = new Date(now.getTime() + CANCELLATION_WINDOW_MS);
	await ctx.db
		.insert(requestTable)
		.values({
			userId: ctx.user.id,
			status: "SCHEDULED",
			requestedAt: now,
			scheduledFor,
			completedAt: null,
			lastError: null,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: requestTable.userId,
			set: {
				status: "SCHEDULED",
				requestedAt: now,
				scheduledFor,
				completedAt: null,
				lastError: null,
				updatedAt: now,
			},
		});
	return {
		status: "SCHEDULED",
		requestedAt: now,
		scheduledFor,
		completedAt: null,
		lastError: null,
	};
}

export async function cancel(ctx: UserContext): Promise<{ ok: true }> {
	await ctx.db
		.delete(requestTable)
		.where(
			and(
				eq(requestTable.userId, ctx.user.id),
				inArray(requestTable.status, ["SCHEDULED", "BLOCKED"]),
			),
		);
	return { ok: true };
}

async function hasActiveWork(db: Db, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: orderTable.id })
		.from(orderTable)
		.where(
			and(
				or(
					eq(orderTable.customerId, userId),
					eq(orderTable.courierUserId, userId),
				),
				notInArray(orderTable.status, [...TERMINAL_STATUSES]),
			),
		)
		.limit(1);
	return rows.length > 0;
}

async function anonymize(db: Db, userId: string, now: Date): Promise<void> {
	const users = await db
		.select({ email: userTable.email })
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1);
	const email = users[0]?.email;
	if (!email) return;

	await db.batch(
		batchOf([
			db.delete(sessionTable).where(eq(sessionTable.userId, userId)),
			db.delete(accountTable).where(eq(accountTable.userId, userId)),
			db
				.delete(verificationTable)
				.where(eq(verificationTable.identifier, email)),
			db.delete(tokenTable).where(eq(tokenTable.userId, userId)),
			db.delete(pushDeliveryTable).where(eq(pushDeliveryTable.userId, userId)),
			db.delete(notificationTable).where(eq(notificationTable.userId, userId)),
			db.delete(favoriteTable).where(eq(favoriteTable.userId, userId)),
			db.delete(addressTable).where(eq(addressTable.userId, userId)),
			db.delete(cartTable).where(eq(cartTable.userId, userId)),
			db
				.delete(courierProfileTable)
				.where(eq(courierProfileTable.userId, userId)),
			db.delete(membershipTable).where(eq(membershipTable.userId, userId)),
			db
				.update(uploadTable)
				.set({ ownerUserId: null })
				.where(eq(uploadTable.ownerUserId, userId)),
			db
				.update(orderEventTable)
				.set({ actorUserId: null })
				.where(eq(orderEventTable.actorUserId, userId)),
			db
				.update(auditTable)
				.set({ actorUserId: null })
				.where(eq(auditTable.actorUserId, userId)),
			db
				.update(orderTable)
				.set({
					courierUserId: null,
					courierName: null,
					courierPhone: null,
					courierLat: null,
					courierLng: null,
					courierAccuracy: null,
					courierHeading: null,
					courierSpeed: null,
					courierAt: null,
				})
				.where(eq(orderTable.courierUserId, userId)),
			db
				.update(orderTable)
				.set({ addressId: null, notes: null })
				.where(eq(orderTable.customerId, userId)),
			db
				.update(userTable)
				.set({
					name: "Cuenta eliminada",
					email: `${userId}@deleted.pymeshub.invalid`,
					emailVerified: false,
					image: null,
					phone: null,
					notifyOrderUpdates: false,
					notifyReviewReplies: false,
					showReviewAvatar: false,
					isAdmin: false,
					updatedAt: now,
				})
				.where(eq(userTable.id, userId)),
			db
				.update(requestTable)
				.set({
					status: "COMPLETED",
					completedAt: now,
					lastError: null,
					updatedAt: now,
				})
				.where(eq(requestTable.userId, userId)),
		]),
	);
}

/** Process due requests from the Worker's scheduled handler. */
export async function sweepAccountDeletions(
	db: Db,
	now: Date,
): Promise<{ completed: number; blocked: number; failed: number }> {
	const due = await db
		.select()
		.from(requestTable)
		.where(
			and(
				inArray(requestTable.status, ["SCHEDULED", "BLOCKED"]),
				lte(requestTable.scheduledFor, now),
			),
		)
		.limit(25);
	const result = { completed: 0, blocked: 0, failed: 0 };

	for (const row of due) {
		try {
			await assertNotLastOwner(db, row.userId);
			if (await hasActiveWork(db, row.userId)) {
				await db
					.update(requestTable)
					.set({
						status: "BLOCKED",
						scheduledFor: new Date(now.getTime() + RETRY_BLOCKED_MS),
						lastError: "active_order",
						updatedAt: now,
					})
					.where(eq(requestTable.userId, row.userId));
				result.blocked += 1;
				continue;
			}
			await anonymize(db, row.userId, now);
			result.completed += 1;
		} catch (error) {
			await db
				.update(requestTable)
				.set({
					status: "BLOCKED",
					scheduledFor: new Date(now.getTime() + RETRY_BLOCKED_MS),
					lastError: error instanceof ConflictError ? "last_owner" : "retry",
					updatedAt: now,
				})
				.where(eq(requestTable.userId, row.userId));
			result.failed += 1;
		}
	}
	return result;
}

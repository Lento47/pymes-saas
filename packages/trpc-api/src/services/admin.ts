import type { Db } from "@pymeshub/db";
import {
	auditLog as auditLogTable,
	business as businessTable,
	category as categoryTable,
	courierProfile as courierProfileTable,
	membership as membershipTable,
	orderEvent as orderEventTable,
	order as orderTable,
	user as ownerTable,
	priceBook as priceBookTable,
	product as productTable,
	subscription as subscriptionTable,
	user as userTable,
} from "@pymeshub/db";
import type {
	AdminApprovalCounts,
	AdminBusinessRow,
	AdminCategoryInput,
	AdminCourierListInput,
	AdminCourierRow,
	AdminListInput,
	AdminMetrics,
	AdminOrderRow,
	AdminSubscription,
	AdminUserRow,
	AuditLogEntry,
	Category,
	Subscription,
	SubscriptionStatus,
} from "@pymeshub/shared";
import { canTransition, decodeCursor, newId } from "@pymeshub/shared";
import {
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	PLAN_PERIOD_DAYS,
} from "@pymeshub/shared/plans";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	like,
	lte,
	notInArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { ConflictError } from "../errors";
import { auditStatement, requireReason } from "./audit";
import type { UserContext } from "./helpers";
import { batchOf, likePattern, orNotFound } from "./helpers";
import {
	adminBusinessRowOf,
	adminOrderRowOf,
	adminUserRowOf,
	auditLogEntryOf,
	categoryOf,
	currencyOf,
} from "./mappers";
import * as subscriptionService from "./subscription";
import { DAY_MS } from "./subscription";

/**
 * The platform operator's surface.
 *
 * Three rules run through every function here:
 *
 * - **Every mutation writes an `audit_log` row**, in the same `batch` as the change it
 *   describes. A suspension nobody can explain six months later is a suspension that
 *   gets reverted by whoever shouts loudest, and an audit row written in a second
 *   statement is an audit row that can go missing exactly when the change did not.
 * - **A reason is required where a real person loses something** — their storefront,
 *   their account, an order, a payment. `REASON_REQUIRED_ACTIONS` names those, and it
 *   is shared with the clients so the sheet and the API ask for the same field.
 * - **Admins read, they rarely write.** Nothing here edits a business's products or
 *   prices an order. Those are the business's calls; the operator's powers are
 *   visibility, suspension, and the last-resort cancellation.
 */

/**
 * Paging for the admin tables.
 *
 * These are offset cursors, unlike every other list in this API, and the reason is
 * worth stating: an admin table is sorted by `orders` or `revenue`, which are
 * aggregates and not columns on the row being paged. No `(sortValue, id)` tuple can
 * express "the business after the one with 431 orders", so the cursor carries an
 * offset and the response carries `total`, which is what an operator paging a table
 * with a count above it actually needs. A business adding an order mid-scroll can
 * shift a row between pages; that is a table refreshing, not a feed duplicating.
 */
type OffsetCursor = { offset: number };

/**
 * A bare `"50"` is accepted as well as the encoded form, because these responses
 * carry `{ rows, total }` and no next cursor — the page number is the console's own
 * state, so making it encode a base64 tuple to ask for page three would be ceremony
 * with nothing on the other side of it.
 */
function offsetOf(cursor: string | undefined): number {
	if (!cursor) return 0;

	const decoded = decodeCursor<OffsetCursor>(cursor);
	if (decoded && Number.isFinite(decoded.offset) && decoded.offset >= 0) {
		return Math.trunc(decoded.offset);
	}

	const plain = Number(cursor);
	return Number.isFinite(plain) && plain >= 0 ? Math.trunc(plain) : 0;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * The platform at a glance.
 *
 * Money is grouped by currency and never added across them — "₡4 200 000 + $1 300" has
 * no answer, and a dashboard that renders one is a dashboard an operator makes a
 * decision on.
 */
/**
 * How deep each approval queue is, in one read.
 *
 * The console's badge used to get these two numbers by asking `metrics` — a ~30-row payload
 * that refetches every 30 seconds — for one of them, and by paging `courierProfiles` with
 * `limit: 1` and reading `.total` off the single row for the other. This is the same two
 * integers, honestly named, without either of those.
 *
 * **The predicates are copied, not re-derived, and that is the point.** A count that drifts
 * from the list it sends you to is worse than no badge: the operator sees 4, opens the queue,
 * and finds 3, and concludes one was handled by somebody who did not say so. So:
 *
 * - `pendingVerification` is `metrics`' own predicate, `is_verified = 0 and status <>
 *   'SUSPENDED'` — a suspended shop is not waiting for verification, it is suspended.
 * - `pendingCouriers` is `courierProfiles`' own predicate, `verification_status = 'PENDING'`,
 *   **inner-joined to `user`** because that list is. A profile whose user row has gone is not
 *   in the list an operator reaches, so counting it would raise the badge above its own page.
 *
 * Two `count(*)` over indexes, in one `Promise.all`, cross-tenant — which is what an approval
 * queue is: one list across everybody's shops, not one per tenant.
 */
export async function approvalCounts(
	ctx: UserContext,
): Promise<AdminApprovalCounts> {
	const [businesses, couriers] = await Promise.all([
		ctx.db
			.select({
				total: sql<number>`coalesce(sum(case when ${businessTable.isVerified} = 0 and ${businessTable.status} <> 'SUSPENDED' then 1 else 0 end), 0)`,
			})
			.from(businessTable),
		ctx.db
			.select({
				total: sql<number>`count(*)`,
			})
			.from(courierProfileTable)
			.innerJoin(userTable, eq(courierProfileTable.userId, userTable.id))
			.where(eq(courierProfileTable.verificationStatus, "PENDING")),
	]);

	return {
		pendingVerification: Number(businesses[0]?.total ?? 0),
		pendingCouriers: Number(couriers[0]?.total ?? 0),
	};
}

export async function metrics(ctx: UserContext): Promise<AdminMetrics> {
	const now = new Date();
	const todayStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const signupsFrom = new Date(todayStart.getTime() - 29 * 86_400_000);

	const [businessCounts, userCounts, orderCounts, volume, signups] =
		await Promise.all([
			ctx.db
				.select({
					total: sql<number>`count(*)`,
					active: sql<number>`coalesce(sum(case when ${businessTable.status} = 'ACTIVE' then 1 else 0 end), 0)`,
					suspended: sql<number>`coalesce(sum(case when ${businessTable.status} = 'SUSPENDED' then 1 else 0 end), 0)`,
					pendingVerification: sql<number>`coalesce(sum(case when ${businessTable.isVerified} = 0 and ${businessTable.status} <> 'SUSPENDED' then 1 else 0 end), 0)`,
				})
				.from(businessTable),
			ctx.db
				.select({
					total: sql<number>`count(*)`,
					admins: sql<number>`coalesce(sum(case when ${userTable.isAdmin} = 1 then 1 else 0 end), 0)`,
					suspended: sql<number>`coalesce(sum(case when ${userTable.suspendedAt} is not null then 1 else 0 end), 0)`,
				})
				.from(userTable),
			ctx.db
				.select({
					total: sql<number>`count(*)`,
					today: sql<number>`coalesce(sum(case when ${orderTable.placedAt} >= ${todayStart.getTime()} then 1 else 0 end), 0)`,
					active: sql<number>`coalesce(sum(case when ${orderTable.status} in ('PENDING','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY') then 1 else 0 end), 0)`,
					cancelled: sql<number>`coalesce(sum(case when ${orderTable.status} in ('CANCELLED','REJECTED') then 1 else 0 end), 0)`,
				})
				.from(orderTable),
			ctx.db
				.select({
					currency: orderTable.currency,
					grossMinor: sql<number>`coalesce(sum(${orderTable.totalMinor}), 0)`,
					orderCount: sql<number>`count(*)`,
				})
				.from(orderTable)
				.where(notInArray(orderTable.status, ["CANCELLED", "REJECTED"]))
				.groupBy(orderTable.currency),
			ctx.db
				.select({
					day: sql<string>`strftime('%Y-%m-%d', ${businessTable.createdAt} / 1000, 'unixepoch')`,
					count: sql<number>`count(*)`,
				})
				.from(businessTable)
				.where(gte(businessTable.createdAt, signupsFrom))
				.groupBy(sql`1`)
				.orderBy(sql`1 asc`),
		]);

	const businesses = businessCounts[0] ?? {
		total: 0,
		active: 0,
		suspended: 0,
		pendingVerification: 0,
	};
	const users = userCounts[0] ?? { total: 0, admins: 0, suspended: 0 };
	const orders = orderCounts[0] ?? {
		total: 0,
		today: 0,
		active: 0,
		cancelled: 0,
	};

	const totalOrders = Number(orders.total);
	const cancelledOrders = Number(orders.cancelled);

	return {
		businesses: {
			total: Number(businesses.total),
			active: Number(businesses.active),
			suspended: Number(businesses.suspended),
			pendingVerification: Number(businesses.pendingVerification),
		},
		users: {
			total: Number(users.total),
			admins: Number(users.admins),
			suspended: Number(users.suspended),
		},
		orders: {
			total: totalOrders,
			today: Number(orders.today),
			active: Number(orders.active),
			// Zero over an empty ledger rather than NaN. A rate with no denominator is not
			// a number, and a dashboard showing "NaN%" is a dashboard nobody trusts again.
			cancelledRate: totalOrders === 0 ? 0 : cancelledOrders / totalOrders,
		},
		volumeByCurrency: volume.map((row) => ({
			currency: currencyOf(row.currency),
			grossMinor: Number(row.grossMinor),
			orderCount: Number(row.orderCount),
		})),
		signupsSeries: signups.map((row) => ({
			day: row.day,
			count: Number(row.count),
		})),
		generatedAt: now,
	};
}

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

/**
 * The business table.
 *
 * The counts are correlated subqueries rather than joins: joining `product` and
 * `order` to the same business multiplies the rows, and a `count(*)` over the product
 * of the two joins is the classic way a dashboard reports 4 000 orders for a shop that
 * has 200. Each aggregate is its own scalar subquery, which SQLite evaluates once per
 * row and which cannot multiply anything.
 */
export async function businesses(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminBusinessRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		conditions.push(
			or(
				like(businessTable.name, likePattern(input.search)),
				like(businessTable.slug, likePattern(input.search)),
			),
		);
	}
	if (input.status && input.status.length > 0) {
		conditions.push(inArray(businessTable.status, input.status));
	}
	if (input.from) conditions.push(gte(businessTable.createdAt, input.from));
	if (input.to) conditions.push(lte(businessTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;

	const sortExpression = {
		newest: sql`${businessTable.createdAt}`,
		name: sql`${businessTable.name}`,
		orders: ORDER_COUNT_SQL,
		revenue: GROSS_VOLUME_SQL,
	}[input.sort];

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				business: businessTable,
				ownerName: OWNER_NAME_SQL,
				ownerEmail: OWNER_EMAIL_SQL,
				productCount: PRODUCT_COUNT_SQL,
				orderCount: ORDER_COUNT_SQL,
				grossVolumeMinor: GROSS_VOLUME_SQL,
				suspendedReason: SUSPENDED_REASON_SQL,
			})
			.from(businessTable)
			.where(where)
			// By position or by expression, never by an interpolated identifier: the sort
			// key is resolved through a fixed map above, so a caller cannot name a column.
			.orderBy(sql`${sortExpression} ${direction}`, asc(businessTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(businessTable)
			.where(where),
	]);

	return {
		rows: rows.map((row) =>
			adminBusinessRowOf({
				business: row.business,
				ownerName: row.ownerName,
				ownerEmail: row.ownerEmail,
				productCount: Number(row.productCount),
				orderCount: Number(row.orderCount),
				grossVolumeMinor: Number(row.grossVolumeMinor),
				suspendedReason: row.suspendedReason,
			}),
		),
		total: Number(counted[0]?.total ?? 0),
	};
}

/** One business, with its recent orders and its audit history. */
export async function business(
	ctx: UserContext,
	input: { id: string },
): Promise<{
	business: AdminBusinessRow;
	recentOrders: AdminOrderRow[];
	auditLog: AuditLogEntry[];
}> {
	const rows = await ctx.db
		.select({
			business: businessTable,
			ownerName: OWNER_NAME_SQL,
			ownerEmail: OWNER_EMAIL_SQL,
			productCount: PRODUCT_COUNT_SQL,
			orderCount: ORDER_COUNT_SQL,
			grossVolumeMinor: GROSS_VOLUME_SQL,
			suspendedReason: SUSPENDED_REASON_SQL,
		})
		.from(businessTable)
		.where(eq(businessTable.id, input.id))
		.limit(1);

	const row = orNotFound(rows[0]);

	const [recentOrders, history] = await Promise.all([
		ctx.db
			.select({
				order: orderTable,
				businessName: businessTable.name,
				customerName: userTable.name,
			})
			.from(orderTable)
			.innerJoin(businessTable, eq(orderTable.businessId, businessTable.id))
			.innerJoin(userTable, eq(orderTable.customerId, userTable.id))
			.where(eq(orderTable.businessId, input.id))
			.orderBy(desc(orderTable.placedAt))
			.limit(10),
		auditEntriesFor(ctx.db, { targetId: input.id, limit: 25 }),
	]);

	return {
		business: adminBusinessRowOf({
			business: row.business,
			ownerName: row.ownerName,
			ownerEmail: row.ownerEmail,
			productCount: Number(row.productCount),
			orderCount: Number(row.orderCount),
			grossVolumeMinor: Number(row.grossVolumeMinor),
			suspendedReason: row.suspendedReason,
		}),
		recentOrders: recentOrders.map((entry) =>
			adminOrderRowOf({
				order: entry.order,
				businessName: entry.businessName,
				customerName: entry.customerName,
			}),
		),
		auditLog: history,
	};
}

export async function suspendBusiness(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<AdminBusinessRow> {
	const reason = requireReason("business.suspend", input.reason);

	const current = await readBusiness(ctx.db, input.targetId);
	const now = new Date();

	await ctx.db.batch([
		ctx.db
			.update(businessTable)
			.set({ status: "SUSPENDED", updatedAt: now })
			.where(eq(businessTable.id, input.targetId)),
		auditStatement(ctx, {
			action: "business.suspend",
			targetType: "business",
			targetId: input.targetId,
			before: { status: current.status },
			after: { status: "SUSPENDED" },
			reason,
			now,
		}),
	]);

	return readBusinessRow(ctx.db, input.targetId);
}

export async function reactivateBusiness(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<AdminBusinessRow> {
	// Not in `REASON_REQUIRED_ACTIONS`: giving a shop back its storefront is not the
	// act that needs defending. The audit row is still written.
	const current = await readBusiness(ctx.db, input.targetId);
	const now = new Date();

	await ctx.db.batch([
		ctx.db
			.update(businessTable)
			.set({ status: "ACTIVE", updatedAt: now })
			.where(eq(businessTable.id, input.targetId)),
		auditStatement(ctx, {
			action: "business.reactivate",
			targetType: "business",
			targetId: input.targetId,
			before: { status: current.status },
			after: { status: "ACTIVE" },
			reason: input.reason ?? null,
			now,
		}),
	]);

	return readBusinessRow(ctx.db, input.targetId);
}

export async function verifyBusiness(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<AdminBusinessRow> {
	const current = await readBusiness(ctx.db, input.targetId);
	const now = new Date();

	await ctx.db.batch([
		ctx.db
			.update(businessTable)
			.set({ isVerified: true, updatedAt: now })
			.where(eq(businessTable.id, input.targetId)),
		auditStatement(ctx, {
			action: "business.verify",
			targetType: "business",
			targetId: input.targetId,
			before: { isVerified: current.isVerified },
			after: { isVerified: true },
			reason: input.reason ?? null,
			now,
		}),
	]);

	return readBusinessRow(ctx.db, input.targetId);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function users(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminUserRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		conditions.push(
			or(
				like(userTable.name, likePattern(input.search)),
				like(userTable.email, likePattern(input.search)),
			),
		);
	}
	if (input.from) conditions.push(gte(userTable.createdAt, input.from));
	if (input.to) conditions.push(lte(userTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;
	const sortExpression = {
		// `status` has no meaning on a user row; falling back to the creation date keeps
		// the table's own sort control from producing an arbitrary order.
		newest: sql`${userTable.createdAt}`,
		name: sql`${userTable.name}`,
		orders: ORDER_COUNT_BY_CUSTOMER_SQL,
		revenue: TOTAL_SPENT_BY_CUSTOMER_SQL,
	}[input.sort];

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({ user: userTable, orderCount: ORDER_COUNT_BY_CUSTOMER_SQL })
			.from(userTable)
			.where(where)
			.orderBy(sql`${sortExpression} ${direction}`, asc(userTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(userTable)
			.where(where),
	]);

	// The roles are fetched for the page's ids rather than joined into the query above:
	// a join would multiply a user by their memberships, and then the `count(*)` total
	// would disagree with the number of rows the table renders.
	const roles = await rolesFor(
		ctx.db,
		rows.map((row) => row.user.id),
	);

	return {
		rows: rows.map((row) =>
			adminUserRowOf({
				user: row.user,
				businessRoles: roles.get(row.user.id) ?? [],
				orderCount: Number(row.orderCount),
			}),
		),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function suspendUser(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<AdminUserRow> {
	const reason = requireReason("user.suspend", input.reason);
	const now = new Date();

	await readUser(ctx.db, input.targetId);

	await ctx.db.batch([
		ctx.db
			.update(userTable)
			.set({ suspendedAt: now, updatedAt: now })
			.where(eq(userTable.id, input.targetId)),
		auditStatement(ctx, {
			action: "user.suspend",
			targetType: "user",
			targetId: input.targetId,
			before: { suspendedAt: null },
			after: { suspendedAt: now.toISOString() },
			reason,
			now,
		}),
	]);

	return readUserRow(ctx.db, input.targetId);
}

/**
 * Grant the platform flag.
 *
 * Deliberately not reachable from a business's own screens: `isAdmin` is not a
 * capability any membership confers, so no tenant can promote anybody.
 *
 * There is no revoke. `api-surface.md` documents `grantAdmin` and nothing opposite it,
 * so this does not invent one — the consequence is worth stating rather than papering
 * over: an admin who should not be one any more is suspended as a user, or demoted in
 * SQL, and either way the audit entry says who did it.
 */
export async function grantAdmin(
	ctx: UserContext,
	input: { userId: string },
): Promise<AdminUserRow> {
	const now = new Date();
	const target = await readUser(ctx.db, input.userId);

	if (target.isAdmin) return readUserRow(ctx.db, input.userId);

	await ctx.db.batch([
		ctx.db
			.update(userTable)
			.set({ isAdmin: true, updatedAt: now })
			.where(eq(userTable.id, input.userId)),
		auditStatement(ctx, {
			action: "user.grant_admin",
			targetType: "user",
			targetId: input.userId,
			before: { isAdmin: false },
			after: { isAdmin: true },
			reason: null,
			now,
		}),
	]);

	return readUserRow(ctx.db, input.userId);
}

// ---------------------------------------------------------------------------
// People — one account, every profile it owns
// ---------------------------------------------------------------------------

/**
 * One person with everything the console needs to answer "what is wrong with
 * this account": their memberships, their courier profile, their recent orders
 * and the audit trail that touched them.
 */
export async function userDetail(
	ctx: UserContext,
	input: { id: string },
): Promise<{
	user: AdminUserRow;
	courierProfile: AdminCourierRow | null;
	recentOrders: AdminOrderRow[];
	auditLog: AuditLogEntry[];
}> {
	const user = await readUserRow(ctx.db, input.id);
	const courier = await ctx.db
		.select({
			profile: courierProfileTable,
			userName: userTable.name,
			userEmail: userTable.email,
		})
		.from(courierProfileTable)
		.innerJoin(userTable, eq(courierProfileTable.userId, userTable.id))
		.where(eq(courierProfileTable.userId, input.id))
		.limit(1);

	const [orders, profileAudit] = await Promise.all([
		ctx.db
			.select({
				order: orderTable,
				businessName: businessTable.name,
				customerName: userTable.name,
			})
			.from(orderTable)
			.innerJoin(businessTable, eq(orderTable.businessId, businessTable.id))
			.innerJoin(userTable, eq(orderTable.customerId, userTable.id))
			.where(eq(orderTable.customerId, input.id))
			.orderBy(desc(orderTable.placedAt))
			.limit(10),
		courier[0]
			? auditEntriesFor(ctx.db, {
					targetId: courier[0].profile.id,
					limit: 25,
				})
			: Promise.resolve([]),
	]);

	return {
		user,
		courierProfile: courier[0] ? adminCourierRowOf(courier[0]) : null,
		recentOrders: orders.map((row) =>
			adminOrderRowOf({
				order: row.order,
				businessName: row.businessName,
				customerName: row.customerName,
			}),
		),
		auditLog: [
			...(await auditEntriesFor(ctx.db, { targetId: input.id, limit: 25 })),
			...profileAudit,
		].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
	};
}

// ---------------------------------------------------------------------------
// Courier review
// ---------------------------------------------------------------------------

function adminCourierRowOf(row: {
	profile: typeof courierProfileTable.$inferSelect;
	userName: string;
	userEmail: string;
}): AdminCourierRow {
	return {
		...row.profile,
		userName: row.userName,
		userEmail: row.userEmail,
	};
}

export async function courierProfiles(
	ctx: UserContext,
	input: AdminCourierListInput,
): Promise<{ rows: AdminCourierRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];
	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(
				like(courierProfileTable.displayName, pattern),
				like(courierProfileTable.serviceArea, pattern),
				like(userTable.name, pattern),
				like(userTable.email, pattern),
			),
		);
	}
	if (input.status)
		conditions.push(eq(courierProfileTable.verificationStatus, input.status));
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				profile: courierProfileTable,
				userName: userTable.name,
				userEmail: userTable.email,
			})
			.from(courierProfileTable)
			.innerJoin(userTable, eq(courierProfileTable.userId, userTable.id))
			.where(where)
			.orderBy(desc(courierProfileTable.createdAt), asc(courierProfileTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(courierProfileTable)
			.innerJoin(userTable, eq(courierProfileTable.userId, userTable.id))
			.where(where),
	]);

	return {
		rows: rows.map(adminCourierRowOf),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function reviewCourier(
	ctx: UserContext,
	input: {
		profileId: string;
		decision: "VERIFIED" | "REJECTED";
		reason?: string;
	},
): Promise<AdminCourierRow> {
	const rows = await ctx.db
		.select({
			profile: courierProfileTable,
			userName: userTable.name,
			userEmail: userTable.email,
		})
		.from(courierProfileTable)
		.innerJoin(userTable, eq(courierProfileTable.userId, userTable.id))
		.where(eq(courierProfileTable.id, input.profileId))
		.limit(1);
	const row = orNotFound(rows[0]);
	if (row.profile.verificationStatus === input.decision) {
		return adminCourierRowOf(row);
	}

	const now = new Date();
	const action =
		input.decision === "VERIFIED" ? "courier.verify" : "courier.reject";
	const reason =
		input.decision === "REJECTED"
			? requireReason(action, input.reason)
			: (input.reason ?? "");

	await ctx.db.batch([
		ctx.db
			.update(courierProfileTable)
			.set({
				verificationStatus: input.decision,
				reviewedAt: now,
				reviewedByUserId: ctx.user.id,
				updatedAt: now,
			})
			.where(eq(courierProfileTable.id, input.profileId)),
		auditStatement(ctx, {
			action,
			targetType: "courier_profile",
			targetId: input.profileId,
			before: { verificationStatus: row.profile.verificationStatus },
			after: { verificationStatus: input.decision },
			reason: reason || null,
			now,
		}),
	]);

	return adminCourierRowOf({
		profile: {
			...row.profile,
			verificationStatus: input.decision,
			reviewedAt: now,
			reviewedByUserId: ctx.user.id,
			updatedAt: now,
		},
		userName: row.userName,
		userEmail: row.userEmail,
	});
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Take a product out of the storefront without touching the shop's own copy.
 *
 * `ARCHIVED` is the same terminal state the business's own archive uses: an
 * order line can still point at the row, and an operator who needs to put it
 * back can do so from the shop's product form. The reason is required because
 * this is the action that removes a saleable item from customers' view.
 */
export async function unpublishProduct(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<{ ok: true }> {
	const reason = requireReason("product.unpublish", input.reason);
	const rows = await ctx.db
		.select({ product: productTable })
		.from(productTable)
		.where(eq(productTable.id, input.targetId))
		.limit(1);
	const row = orNotFound(rows[0]);

	if (row.product.status === "ARCHIVED") return { ok: true };

	const now = new Date();
	await ctx.db.batch([
		ctx.db
			.update(productTable)
			.set({
				status: "ARCHIVED",
				isFeatured: false,
				updatedAt: now,
			})
			.where(eq(productTable.id, input.targetId)),
		auditStatement(ctx, {
			action: "product.unpublish",
			targetType: "product",
			targetId: input.targetId,
			before: { status: row.product.status },
			after: { status: "ARCHIVED" },
			reason,
			now,
		}),
	]);

	return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function orders(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: AdminOrderRow[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search) {
		conditions.push(
			or(
				like(orderTable.reference, likePattern(input.search)),
				like(businessTable.name, likePattern(input.search)),
			),
		);
	}
	if (input.from) conditions.push(gte(orderTable.placedAt, input.from));
	if (input.to) conditions.push(lte(orderTable.placedAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;
	const sortExpression = {
		// A `status` filter on an order table is a status *list* in this API, and
		// `AdminListInput.status` carries business statuses — so it is not applied here
		// rather than applied wrongly.
		newest: sql`${orderTable.placedAt}`,
		name: sql`${orderTable.reference}`,
		orders: sql`${orderTable.placedAt}`,
		revenue: sql`${orderTable.totalMinor}`,
	}[input.sort];

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				order: orderTable,
				businessName: businessTable.name,
				customerName: userTable.name,
			})
			.from(orderTable)
			.innerJoin(businessTable, eq(orderTable.businessId, businessTable.id))
			.innerJoin(userTable, eq(orderTable.customerId, userTable.id))
			.where(where)
			.orderBy(sql`${sortExpression} ${direction}`, asc(orderTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(orderTable)
			.innerJoin(businessTable, eq(orderTable.businessId, businessTable.id))
			.where(where),
	]);

	return {
		rows: rows.map((entry) =>
			adminOrderRowOf({
				order: entry.order,
				businessName: entry.businessName,
				customerName: entry.customerName,
			}),
		),
		total: Number(counted[0]?.total ?? 0),
	};
}

/**
 * The last-resort cancellation.
 *
 * It goes through `canTransition` with the ADMIN actor like every other move, so an
 * admin cannot cancel a completed order here any more than a business could — the
 * machine is the machine, whatever the role. This is the only path that reaches
 * `OUT_FOR_DELIVERY → CANCELLED`, which no business may take.
 */
export async function cancelOrder(
	ctx: UserContext,
	input: { targetId: string; reason?: string },
): Promise<AdminOrderRow> {
	const reason = requireReason("order.cancel", input.reason);

	const rows = await ctx.db
		.select({
			order: orderTable,
			businessName: businessTable.name,
			customerName: userTable.name,
		})
		.from(orderTable)
		.innerJoin(businessTable, eq(orderTable.businessId, businessTable.id))
		.innerJoin(userTable, eq(orderTable.customerId, userTable.id))
		.where(eq(orderTable.id, input.targetId))
		.limit(1);

	const row = orNotFound(rows[0]);
	const now = new Date();

	if (
		!canTransition({
			from: row.order.status,
			to: "CANCELLED",
			actor: "ADMIN",
			fulfilment: row.order.fulfilment,
		})
	) {
		throw new ConflictError("Este pedido ya no se puede cancelar", {
			status: row.order.status,
		});
	}

	await ctx.db.batch([
		ctx.db
			.update(orderTable)
			.set({
				status: "CANCELLED",
				cancelledAt: now,
				cancelReason: reason,
				updatedAt: now,
			})
			.where(eq(orderTable.id, input.targetId)),
		ctx.db.insert(orderEventTable).values({
			id: newId("orderEvent"),
			orderId: input.targetId,
			fromStatus: row.order.status,
			toStatus: "CANCELLED",
			actor: "ADMIN",
			actorUserId: ctx.user.id,
			note: reason,
			createdAt: now,
		}),
		auditStatement(ctx, {
			action: "order.cancel",
			targetType: "order",
			targetId: input.targetId,
			before: { status: row.order.status },
			after: { status: "CANCELLED" },
			reason,
			now,
		}),
	]);

	return adminOrderRowOf({
		order: {
			...row.order,
			status: "CANCELLED",
			cancelledAt: now,
			cancelReason: reason,
		},
		businessName: row.businessName,
		customerName: row.customerName,
	});
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Every merchant's billing, newest debt first.
 *
 * This replaces the `payouts` list, and the shape of the question changed with the
 * business model. The old one asked "which settlement runs are outstanding" and
 * answered with a gross, a fee and a net. There is no settlement now — the consumer
 * pays the merchant and the courier directly — so the question is **"who owes us
 * money, for how long, and at what price"**, and arrears is the number that decides
 * whether an operator needs to act today.
 *
 * `arrearsMinor` is computed in SQL from the stored price rather than summed from
 * payment rows, because a subscription stores one `priceMinor` and one `periodEnd`
 * and nothing else: a merchant's debt is "every period since `periodEnd`", which is
 * arithmetic on two columns rather than a walk over a ledger. The whole-period count
 * is the same division, and it is what separates "a week late" from "gone for a
 * month" on the operator's screen.
 *
 * `status` is derived **in SQL**, from `periodEnd`/`gracedUntil` against `now` — not read
 * from the stored `subscription.status` column, which is whatever last wrote the row. An
 * operator filtering `PAST_DUE` must see the shops that are past due *today*, not the ones a
 * sweeper happened to write down. The derivation lives in one expression, `derivedStatusSql`,
 * read by both the rows query and the count, so `total` counts the filtered set and the
 * pager's arithmetic is right.
 */
export async function subscriptions(
	ctx: UserContext,
	input: Omit<AdminListInput, "status" | "sort"> & {
		/** A single billing status, not the business-status array `AdminListInput` carries. */
		status?: SubscriptionStatus;
		/**
		 * `arrears` is the default and the only sort that answers "who needs chasing",
		 * which is why it leads: an operator opening this table is looking for debt, not
		 * for a list. `periodEnd` and `businessName` are for finding one shop.
		 */
		sort: "arrears" | "periodEnd" | "businessName";
	},
): Promise<{ rows: AdminSubscription[]; total: number }> {
	const now = new Date();
	const offset = offsetOf(input.cursor);
	const conditions: SQL[] = [];

	if (input.search) {
		// `or` returns `undefined` when every argument is, which cannot happen here —
		// both branches are always `SQL`. The guard rather than a `!` is the honest
		// spelling of that: this `conditions` array is typed `SQL[]` (the two existing
		// search filters above are on an untyped `conditions = []`, which is why they
		// need no guard and also catch nothing).
		const matches = or(
			like(businessTable.name, likePattern(input.search)),
			like(ownerTable.email, likePattern(input.search)),
		);
		if (matches) conditions.push(matches);
	}
	if (input.from)
		conditions.push(gte(subscriptionTable.periodStart, input.from));
	if (input.to) conditions.push(lte(subscriptionTable.periodEnd, input.to));

	// The status filter, pushed down into `conditions` so it lands in the `where` that
	// **both** queries share. Before this it was applied after shaping, which left the count
	// describing the unfiltered set. See `derivedStatusSql`.
	if (input.status)
		conditions.push(sql`${derivedStatusSql(now)} = ${input.status}`);

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;

	const periodsSql = periodsSqlFor(now);
	const arrearsSql = arrearsSqlFor(now);

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				subscription: subscriptionTable,
				businessName: businessTable.name,
				ownerEmail: ownerTable.email,
				currency: businessTable.currency,
				arrearsMinor: arrearsSql,
				periodsOwed: periodsSql,
				// Read back from the same expression the filter uses, rather than re-derived in
				// JavaScript, so a row can never be counted under one status and displayed
				// under another. See `derivedStatusSql`.
				derivedStatus: derivedStatusSql(now),
			})
			.from(subscriptionTable)
			.innerJoin(
				businessTable,
				eq(businessTable.id, subscriptionTable.businessId),
			)
			.leftJoin(ownerTable, eq(ownerTable.id, ownerUserIdSql))
			.where(where)
			.orderBy(sql`${arrearsSql} ${direction}`, asc(subscriptionTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(subscriptionTable)
			.innerJoin(
				businessTable,
				eq(businessTable.id, subscriptionTable.businessId),
			)
			// The same `leftJoin(user)` the rows query above has, and for the same reason:
			// `where` is shared between the two, and the search branch puts `user.email` in
			// it. Without this join SQLite fails on `no such column: user.email` and the whole
			// request 500s — which is what an operator gets the moment they type in the Cobros
			// search box. Found in production; see the test beside it.
			.leftJoin(ownerTable, eq(ownerTable.id, ownerUserIdSql))
			.where(where),
	]);

	const books = await subscriptionPriceBooks(ctx.db, [
		...new Set(rows.map((row) => row.subscription.priceBookId)),
	]);

	const shaped = rows.map((row) => {
		const status = row.derivedStatus;
		return {
			id: row.subscription.id,
			businessId: row.subscription.businessId,
			businessName: row.businessName,
			ownerEmail: row.ownerEmail,
			plan: row.subscription.plan,
			status,
			priceMinor: row.subscription.priceMinor,
			currency: currencyOf(row.currency),
			arrearsMinor: Math.max(0, Math.round(row.arrearsMinor ?? 0)),
			periodsOwed: Math.max(0, row.periodsOwed ?? 0),
			periodStart: row.subscription.periodStart,
			periodEnd: row.subscription.periodEnd,
			gracedUntil: row.subscription.gracedUntil,
			lastPaidAt: row.subscription.lastPaidAt,
			priceBookLabel: books.get(row.subscription.priceBookId) ?? null,
			suspended: status === "SUSPENDED",
		};
	});

	return {
		// `shaped` is the page the `where` above selected — the status filter is already
		// applied, so no second pass here. `total` is that same `where` counted, which is
		// what makes a pager honest: "page 1 of 3" over 3 matching rows, never over 3 rows
		// of which 1 matched.
		rows: shaped,
		total: Number(counted[0]?.total ?? 0),
	};
}

/**
 * The OWNER's membership on a business — the address a debt reminder goes to.
 *
 * A subquery rather than a join because `membership` has four roles and a business can
 * have several members: joining it would multiply the row. A scalar subquery with an
 * `OWNER` filter returns at most one address, which is what the column means.
 */
const ownerUserIdSql = sql`(
	select m.user_id from membership m
	where m.business_id = ${businessTable.id} and m.role = 'OWNER'
	order by m.created_at
	limit 1
)`;

/** Price-book labels for a page of rows, in one read. */
async function subscriptionPriceBooks(
	db: Db,
	ids: readonly string[],
): Promise<Map<string, string>> {
	const labels = new Map<string, string>();
	if (ids.length === 0) return labels;
	const rows = await db
		.select({ id: priceBookTable.id, label: priceBookTable.label })
		.from(priceBookTable)
		.where(inArray(priceBookTable.id, [...ids]));
	for (const row of rows) labels.set(row.id, row.label);
	return labels;
}

/**
 * Recording that a merchant paid.
 *
 * The reference is the bank's or SINPE's, and it lives only in the audit entry's
 * `meta` — there is no column for it, and adding one would be a migration for a field
 * only an operator ever writes. Reading it back from the audit log is not a
 * workaround; it is the same append-only record reached from the other side.
 *
 * The status and the next period are written by `subscription.recordPayment`, which
 * owns the price book. What this adds is the **audit trail and the double-payment
 * guard**: a second payment for a subscription already in `ACTIVE` with a live period
 * is a conflict, because it is either a mistake or two people paying the same bill.
 */
export async function recordSubscriptionPayment(
	ctx: UserContext,
	input: {
		subscriptionId: string;
		amountMinor: number;
		reference: string;
		reason: string;
	},
): Promise<Subscription> {
	const reason = requireReason("subscription.record_payment", input.reason);

	const now = new Date();

	const rows = await ctx.db
		.select({
			subscription: subscriptionTable,
			// The debt as it stands *before* the write, from the same expression the arrears
			// table renders — see `arrearsSqlFor`. Read here because a payment resets
			// `periodEnd`, and after the write the debt is zero by construction and tells us
			// nothing about what was forgiven.
			arrearsBeforeMinor: arrearsSqlFor(now),
		})
		.from(subscriptionTable)
		.where(eq(subscriptionTable.id, input.subscriptionId))
		.limit(1);
	const row = orNotFound(rows[0]);

	const periodEnded =
		row.subscription.periodEnd !== null &&
		row.subscription.periodEnd.getTime() <= now.getTime();
	// A payment for a period still running is a double payment, not a prepayment:
	// the platform is not a credit account and a merchant who pays early has made a
	// mistake an operator should see.
	if (!periodEnded) {
		throw new ConflictError(
			"Este negocio ya tiene un periodo vigente. Registra el pago cuando venza.",
		);
	}

	const arrearsBeforeMinor = Math.max(
		0,
		Math.round(row.arrearsBeforeMinor ?? 0),
	);
	const invoicedMinor = row.subscription.priceMinor ?? 0;
	// A trial owes nothing and is not owed anything; `recordPayment` refuses a ₡0 payment
	// with a named error rather than writing one.
	const paidMinor = input.amountMinor;
	const writtenOffMinor = Math.max(0, arrearsBeforeMinor - paidMinor);

	/**
	 * The operator's figure goes through, not ours.
	 *
	 * This used to pass `row.subscription.priceMinor ?? 0` — the expected amount — which
	 * meant the callee's own comparison was `x !== x` and could never fire. A validation
	 * written specifically to catch a miscount was disabled by its only caller, and the
	 * amount the operator typed was discarded: the audit row recorded the *next* period's
	 * price, under a key called `priceMinor`, which any reader would take for what had
	 * been collected.
	 */
	const after = await subscriptionService.recordPayment(
		ctx,
		{
			subscriptionId: input.subscriptionId,
			amountMinor: paidMinor,
			reference: input.reference,
			reason,
		},
		now,
	);

	// After the write, not before: the audit entry has to describe the transition that
	// actually happened, and `after` is the row the merchant is now looking at. An
	// audit written from a prediction is an audit that can be wrong.
	await ctx.db.batch(
		batchOf([
			auditStatement(ctx, {
				action: "subscription.record_payment",
				targetType: "subscription",
				targetId: input.subscriptionId,
				before: {
					status: row.subscription.status,
					periodEnd: row.subscription.periodEnd?.toISOString() ?? null,
					gracedUntil: row.subscription.gracedUntil?.toISOString() ?? null,
					lastPaidAt: row.subscription.lastPaidAt?.toISOString() ?? null,
					arrearsMinor: arrearsBeforeMinor,
				},
				after: {
					status: after.status,
					periodStart: after.periodStart?.toISOString() ?? null,
					periodEnd: after.periodEnd?.toISOString() ?? null,
					lastPaidAt: after.lastPaidAt?.toISOString() ?? null,
					/**
					 * Every number named for what it is.
					 *
					 * `paidMinor` is what the operator collected. `invoicedMinor` is the
					 * price of the period being settled. `differenceMinor` is the two apart,
					 * and it is non-zero when a merchant overpaid — which is recorded, not
					 * refused, and needs no second place to explain itself.
					 *
					 * `nextPeriodMinor` is the successor period's price, priced from the book
					 * in force now. This used to be written as `priceMinor`, sitting one key
					 * away from money that had actually been collected: an audit log is read
					 * months later by someone who has no way to know which of two nearby
					 * figures meant what.
					 *
					 * `writtenOffMinor` is the debt this payment cleared without anyone paying
					 * it. A payment resets `periodEnd`, and arrears is derived from
					 * `periodEnd`, so three periods of debt become zero on one payment — the
					 * guard then refuses a second for the length of the new period, so it
					 * cannot be paid down in instalments. That is the intended rule (no
					 * prepayments, one period per payment), and this row is where the operator
					 * signs off on what it cost.
					 */
					paidMinor,
					invoicedMinor,
					differenceMinor: paidMinor - invoicedMinor,
					writtenOffMinor,
					nextPeriodMinor: after.priceMinor,
					priceBookLabel: after.priceBookLabel,
				},
				reason,
				reference: input.reference,
				now,
			}),
		]),
	);

	return after;
}

/**
 * The bank reference of the last recorded payment, read back from the audit log.
 *
 * Exported because `businesses.currentSubscription` shows the same reference to the
 * owner, and two implementations of "where is the reference" is how one of them ends
 * up showing nothing.
 */
export async function subscriptionReferencesFor(
	db: Db,
	subscriptionIds: readonly string[],
): Promise<Map<string, string>> {
	const references = new Map<string, string>();
	if (subscriptionIds.length === 0) return references;

	const rows = await db
		.select({ targetId: auditLogTable.targetId, meta: auditLogTable.meta })
		.from(auditLogTable)
		.where(
			and(
				eq(auditLogTable.action, "subscription.record_payment"),
				inArray(auditLogTable.targetId, [...subscriptionIds]),
			),
		)
		.orderBy(asc(auditLogTable.createdAt));

	// Ascending, so a subscription paid twice ends with the latest reference — the one
	// that matches the money that actually moved.
	for (const row of rows) {
		const meta = row.meta as { reference?: unknown } | null;
		if (typeof meta?.reference === "string") {
			references.set(row.targetId, meta.reference);
		}
	}

	return references;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function categories(ctx: UserContext): Promise<Category[]> {
	const rows = await ctx.db
		.select({
			category: categoryTable,
			productCount: PRODUCT_COUNT_BY_CATEGORY_SQL,
		})
		.from(categoryTable)
		.orderBy(asc(categoryTable.sortOrder), asc(categoryTable.name));

	return rows.map((row) => categoryOf(row.category, Number(row.productCount)));
}

/**
 * Create or edit a category.
 *
 * The slug is derived from the name when the form does not send one, because an
 * operator typing fourteen categories should not have to invent fourteen URL-safe
 * strings. Uniqueness is checked here rather than left to the unique index, so the
 * failure is a `CONFLICT` the console can show inline instead of a 500.
 */
export async function saveCategory(
	ctx: UserContext,
	input: AdminCategoryInput,
): Promise<Category> {
	const slug = input.slug ?? slugifyCategory(input.name);
	const now = new Date();

	const clash = await ctx.db
		.select({ id: categoryTable.id })
		.from(categoryTable)
		.where(eq(categoryTable.slug, slug))
		.limit(1);

	if (clash[0] && clash[0].id !== input.id) {
		throw new ConflictError("Ya existe una categoría con ese identificador", {
			slug,
		});
	}

	// Its own parent is a cycle the storefront's navigation could never walk back out of,
	// and the console draws one level down only — so it is refused rather than stored.
	if (input.parentId && input.parentId === input.id) {
		throw new ConflictError(
			"Una categoría no puede ser su propia categoría madre",
			{ parentId: input.parentId },
		);
	}

	// Read rather than left to the foreign key: a parent id that does not exist would
	// otherwise arrive as a constraint failure and a 500, and the console can show a
	// NOT_FOUND against the field it came from.
	if (input.parentId) {
		const parent = await ctx.db
			.select({ id: categoryTable.id })
			.from(categoryTable)
			.where(eq(categoryTable.id, input.parentId))
			.limit(1);

		orNotFound(parent[0]);
	}

	if (input.id) {
		const existing = await ctx.db
			.select({ category: categoryTable })
			.from(categoryTable)
			.where(eq(categoryTable.id, input.id))
			.limit(1);

		const before = orNotFound(existing[0]).category;
		// `??` would be wrong here: it cannot tell "no parent in the payload" from an
		// explicit `null`, which is the operator moving this category out to the top level.
		const parentId =
			input.parentId === undefined ? before.parentId : input.parentId;
		// The same test, for the same reason: absent means the form carried no English name
		// and one already on the row must survive the edit.
		const nameEn = input.nameEn === undefined ? before.nameEn : input.nameEn;
		// And the photograph, which is the field most likely to be absent by accident: the
		// photo lives on the row and not in the name form, so `saveCategory` is regularly
		// called to fix a spelling with no `imageUrl` in the payload at all. Reading `??`
		// here would clear the picture on every one of those calls.
		const imageUrl =
			input.imageUrl === undefined ? before.imageUrl : input.imageUrl;

		await ctx.db.batch([
			ctx.db
				.update(categoryTable)
				.set({
					name: input.name,
					nameEn,
					slug,
					iconName: input.iconName ?? before.iconName,
					parentId,
					imageUrl,
					sortOrder: input.sortOrder,
				})
				.where(eq(categoryTable.id, input.id)),
			auditStatement(ctx, {
				action: "category.update",
				targetType: "category",
				targetId: input.id,
				before: {
					name: before.name,
					nameEn: before.nameEn,
					slug: before.slug,
					parentId: before.parentId,
					// The photograph is audited for the same reason a rename is. An operator
					// swapping the picture on "Alimentos y Bebidas" has changed what the
					// marketplace's first tile looks like to every customer, and an audit log
					// that could not see it would miss the day a sector's art was repointed.
					imageUrl: before.imageUrl,
					sortOrder: before.sortOrder,
				},
				after: {
					name: input.name,
					nameEn,
					slug,
					parentId,
					imageUrl,
					sortOrder: input.sortOrder,
				},
				reason: null,
				now,
			}),
		]);

		const updated = await ctx.db
			.select({
				category: categoryTable,
				productCount: PRODUCT_COUNT_BY_CATEGORY_SQL,
			})
			.from(categoryTable)
			.where(eq(categoryTable.id, input.id))
			.limit(1);

		const row = orNotFound(updated[0]);
		return categoryOf(row.category, Number(row.productCount));
	}

	const id = newId("category");

	await ctx.db.batch([
		ctx.db.insert(categoryTable).values({
			id,
			slug,
			name: input.name,
			nameEn: input.nameEn ?? null,
			iconName: input.iconName ?? null,
			parentId: input.parentId ?? null,
			// `?? null` rather than `?? undefined` because this is an insert and there is no
			// `before` row to inherit from — a category created without a photograph is
			// genuinely null, which is what the column already holds on all 241 seeded rows.
			imageUrl: input.imageUrl ?? null,
			sortOrder: input.sortOrder,
		}),
		auditStatement(ctx, {
			action: "category.create",
			targetType: "category",
			targetId: id,
			before: null,
			after: {
				name: input.name,
				nameEn: input.nameEn ?? null,
				slug,
				parentId: input.parentId ?? null,
				imageUrl: input.imageUrl ?? null,
				sortOrder: input.sortOrder,
			},
			reason: null,
			now,
		}),
	]);

	// Read back rather than assembled from the input: the row is the answer, and a
	// client that receives what it just sent is a client that cannot tell whether the
	// write landed.
	const created = await ctx.db
		.select({
			category: categoryTable,
			productCount: PRODUCT_COUNT_BY_CATEGORY_SQL,
		})
		.from(categoryTable)
		.where(eq(categoryTable.id, id))
		.limit(1);

	const row = orNotFound(created[0]);
	return categoryOf(row.category, Number(row.productCount));
}

/**
 * Delete a category, unless products still use it.
 *
 * Refused rather than cascaded. The foreign key is `on delete set null`, so the
 * database would happily do it — and then every product in that category would quietly
 * lose its place in the storefront's navigation, which an operator would discover from
 * a customer.
 */
export async function deleteCategory(
	ctx: UserContext,
	input: { id: string; reason: string },
): Promise<{ ok: true }> {
	const reason = requireReason("category.delete", input.reason);

	const existing = await ctx.db
		.select({ category: categoryTable })
		.from(categoryTable)
		.where(eq(categoryTable.id, input.id))
		.limit(1);

	const before = orNotFound(existing[0]).category;

	const used = await ctx.db
		.select({ count: sql<number>`count(*)` })
		.from(productTable)
		.where(eq(productTable.categoryId, input.id));

	if (Number(used[0]?.count ?? 0) > 0) {
		throw new ConflictError("Todavía hay productos en esta categoría", {
			productCount: Number(used[0]?.count ?? 0),
		});
	}

	const now = new Date();

	await ctx.db.batch([
		ctx.db.delete(categoryTable).where(eq(categoryTable.id, input.id)),
		auditStatement(ctx, {
			action: "category.delete",
			targetType: "category",
			targetId: input.id,
			before: { name: before.name, slug: before.slug },
			after: null,
			reason,
			now,
		}),
	]);

	return { ok: true };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function auditLogEntries(
	ctx: UserContext,
	input: AdminListInput & { actorId?: string; targetId?: string },
): Promise<{ rows: AuditLogEntry[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.actorId)
		conditions.push(eq(auditLogTable.actorUserId, input.actorId));
	if (input.targetId)
		conditions.push(eq(auditLogTable.targetId, input.targetId));
	if (input.search)
		conditions.push(like(auditLogTable.action, likePattern(input.search)));
	if (input.from) conditions.push(gte(auditLogTable.createdAt, input.from));
	if (input.to) conditions.push(lte(auditLogTable.createdAt, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({ entry: auditLogTable, actorName: userTable.name })
			.from(auditLogTable)
			// Left, not inner: an admin whose account is gone keeps their name on the
			// record of what they did only while the row survives — and the entry itself
			// is what must survive.
			.leftJoin(userTable, eq(auditLogTable.actorUserId, userTable.id))
			.where(where)
			.orderBy(
				sql`${auditLogTable.createdAt} ${direction}`,
				asc(auditLogTable.id),
			)
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(auditLogTable)
			.where(where),
	]);

	return {
		rows: rows.map((row) => auditLogEntryOf(row.entry, row.actorName)),
		total: Number(counted[0]?.total ?? 0),
	};
}

/** The audit history of one target, for the detail drawers. */
async function auditEntriesFor(
	db: Db,
	input: { targetId: string; limit: number },
): Promise<AuditLogEntry[]> {
	const rows = await db
		.select({ entry: auditLogTable, actorName: userTable.name })
		.from(auditLogTable)
		.leftJoin(userTable, eq(auditLogTable.actorUserId, userTable.id))
		.where(eq(auditLogTable.targetId, input.targetId))
		.orderBy(desc(auditLogTable.createdAt))
		.limit(input.limit);

	return rows.map((row) => auditLogEntryOf(row.entry, row.actorName));
}

// ---------------------------------------------------------------------------
// The reads the mutations share
//
// `auditStatement` and `requireReason` used to be defined here, and this file was the
// only place either could be reached from — which is why a price rise, written by
// `services/subscription.ts`, carried neither an audit row nor a reason. They live in
// `./audit` now. The call sites below are untouched, because a move is not a rename.
// ---------------------------------------------------------------------------

async function readBusiness(db: Db, id: string) {
	const rows = await db
		.select()
		.from(businessTable)
		.where(eq(businessTable.id, id))
		.limit(1);
	return orNotFound(rows[0]);
}

async function readBusinessRow(db: Db, id: string): Promise<AdminBusinessRow> {
	const rows = await db
		.select({
			business: businessTable,
			ownerName: OWNER_NAME_SQL,
			ownerEmail: OWNER_EMAIL_SQL,
			productCount: PRODUCT_COUNT_SQL,
			orderCount: ORDER_COUNT_SQL,
			grossVolumeMinor: GROSS_VOLUME_SQL,
			suspendedReason: SUSPENDED_REASON_SQL,
		})
		.from(businessTable)
		.where(eq(businessTable.id, id))
		.limit(1);

	const row = orNotFound(rows[0]);

	return adminBusinessRowOf({
		business: row.business,
		ownerName: row.ownerName,
		ownerEmail: row.ownerEmail,
		productCount: Number(row.productCount),
		orderCount: Number(row.orderCount),
		grossVolumeMinor: Number(row.grossVolumeMinor),
		suspendedReason: row.suspendedReason,
	});
}

async function readUser(db: Db, id: string) {
	const rows = await db
		.select()
		.from(userTable)
		.where(eq(userTable.id, id))
		.limit(1);
	return orNotFound(rows[0]);
}

async function readUserRow(db: Db, id: string): Promise<AdminUserRow> {
	const rows = await db
		.select({ user: userTable, orderCount: ORDER_COUNT_BY_CUSTOMER_SQL })
		.from(userTable)
		.where(eq(userTable.id, id))
		.limit(1);

	const row = orNotFound(rows[0]);
	const roles = await rolesFor(db, [id]);

	return adminUserRowOf({
		user: row.user,
		businessRoles: roles.get(id) ?? [],
		orderCount: Number(row.orderCount),
	});
}

async function rolesFor(
	db: Db,
	userIds: readonly string[],
): Promise<Map<string, AdminUserRow["businessRoles"]>> {
	const roles = new Map<string, AdminUserRow["businessRoles"]>();
	if (userIds.length === 0) return roles;

	const rows = await db
		.select({
			userId: membershipTable.userId,
			businessId: membershipTable.businessId,
			businessName: businessTable.name,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		.where(inArray(membershipTable.userId, [...userIds]));

	for (const row of rows) {
		const list = roles.get(row.userId) ?? [];
		list.push({
			businessId: row.businessId,
			businessName: row.businessName,
			role: row.role,
		});
		roles.set(row.userId, list);
	}

	return roles;
}

/** `Café y pan` → `cafe-y-pan`. Same folding as a business slug, no uniqueness retry. */
function slugifyCategory(name: string): string {
	return name
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

// ---------------------------------------------------------------------------
// The aggregate expressions
//
// Each is a correlated scalar subquery rather than part of a join, and each is
// referenced from more than one query — the list, the detail, and the row a mutation
// returns. Declaring them once is what keeps those three from reporting three
// different counts for one business.
//
// ## Every outer column is written `table.table.column`, and that is not decoration
//
// Drizzle renders an interpolated **Column** inside a `sql` template as its own bare
// name — `"id"`, not `"business"."id"`. It has no way to know the fragment will sit in
// a nested scope, so it cannot qualify it, and SQLite then resolves that name against
// the **innermost** table of the subquery. Written the obvious way, every count below
// read `product.business_id = product.id`, `order.customer_id = order.id` and so on:
// a predicate that is false for every row, so the admin console reported **0 products
// and 0 orders for every business on the platform** while the rows sat in D1.
//
// Interpolating the table first (`${businessTable}` → `"business"`) puts the qualifier
// back. It reads as a duplicate and it is not: the second half is the column, the first
// is the scope that column must be resolved in, and deleting either half reinstates the
// bug. Two of these fragments are worse than a wrong number — `OWNER_NAME_SQL`'s inner
// join puts `"id"` in a scope holding both `membership` and `user`, which SQLite refuses
// outright ("ambiguous column name: id") rather than answering.
//
// The fragments whose subquery reads a **single** table leave their inner columns bare,
// because there is nothing there for them to be confused with. Only the outer reference
// has to be told where it lives.
//
// A value interpolated into the same position is safe and needs none of this: a row
// object's field (`${order.businessId}` in `./reviews`, where `order` is a row and not a
// table) becomes a bound `?`, which is why that file's aggregates are correct as written.
// ---------------------------------------------------------------------------

/**
 * Whole periods a subscription owes at `now`, and the money that is.
 *
 * **Functions rather than constants, because they now have two readers.** They were
 * inline inside `admin.subscriptions`, and when `recordSubscriptionPayment` needed the
 * debt it was clearing — to record how much a payment wrote off — the obvious thing was to
 * write the arithmetic a second time in JavaScript. That is the failure this file's own
 * comments warn about twice: *"Two copies of this arithmetic that drift by one is how an
 * operator is told a merchant owes ₡8,000 when the period count beside it says three."*
 *
 * So there is one copy, and both the arrears table and the audit row that describes a
 * payment read it.
 *
 * - `coalesce(…, 1)` rather than a bare division: a row with no `priceMinor` is a trial,
 *   and a trial owing money is not a state that exists, so a zero divisor is guarded
 *   instead of being allowed to make the whole query null.
 * - `cast(... as integer)` truncates, so 22 days on a 7-day plan is 3 and not 3.14 — a
 *   fraction of a period is not a thing anybody can pay.
 * - `max(1, …)` is what makes the *first* period count: a shop eleven hours past due still
 *   owes one, because the period it bought has ended whether or not they noticed.
 */
function periodsSqlFor(now: Date) {
	const periodMsSql = sql<number>`coalesce(
		case ${subscriptionTable.plan}
			when 'WEEKLY' then ${PLAN_PERIOD_DAYS.WEEKLY * DAY_MS}
			else ${PLAN_PERIOD_DAYS.MONTHLY * DAY_MS}
		end,
		1
	)`;

	return sql<number>`case
		when ${subscriptionTable.periodEnd} is null
			or ${subscriptionTable.periodEnd} > ${now}
			or ${subscriptionTable.priceMinor} is null
		then 0
		else max(1, cast((${now} - ${subscriptionTable.periodEnd}) / ${periodMsSql} as integer))
	end`;
}

/** The same expression the arrears table renders, multiplied out to colones. */
function arrearsSqlFor(now: Date) {
	return sql<number>`(${periodsSqlFor(now)}) * coalesce(${subscriptionTable.priceMinor}, 0)`;
}

/**
 * The subscription's status **as of `now`**, in SQL.
 *
 * ## Why this exists at all
 *
 * `admin.subscriptions` applies its status filter *after* shaping, because the stored
 * `subscription.status` column is whatever last wrote the row and the derived one is the
 * truth. Which left `total` counting the **unfiltered** set, and a pager built on it offering
 * "page 2 of 3" over a single matching row:
 *
 *     filtered PAST_DUE -> rows: 1 | total: 3
 *
 * The filter could not be pushed into SQL because the derived status was computed in
 * JavaScript, one row at a time, after the page had already been chosen.
 *
 * So the derivation moves into SQL, and **both** the rows query and the count query read the
 * same expression. That is the whole fix: the count and the list are now two readings of one
 * statement rather than one reading of a column and one reading of a page.
 *
 * ## It mirrors `subscriptionStatusAt`, and the two must agree
 *
 * `subscriptionStatusAt` is still the authority for the merchant's own screens and for
 * `effectivePlan`, and it reads exactly these four branches. The duplication is real and
 * unavoidable — one is a function over a row, the other an expression over a table — so it is
 * pinned by a spec that seeds a subscription in **each** of the four states and asserts the
 * status this expression produces equals the status the shared helper produces. If someone
 * changes one and not the other, that test fails rather than the console quietly filtering
 * on something else.
 */
function derivedStatusSql(now: Date) {
	const periodEnd = sql`coalesce(${subscriptionTable.periodEnd}, ${subscriptionTable.createdAt})`;
	const gracedUntil = sql`coalesce(${subscriptionTable.gracedUntil}, ${periodEnd} + ${GRACE_DAYS * DAY_MS})`;
	return sql<SubscriptionStatus>`case
		when ${periodEnd} > ${now} then 'ACTIVE'
		when ${now} < ${gracedUntil} then 'GRACE'
		when ${now} - ${periodEnd} >= ${HIDDEN_AFTER_DAYS * DAY_MS} then 'SUSPENDED'
		else 'PAST_DUE'
	end`;
}

const PRODUCT_COUNT_SQL = sql<number>`(select count(*) from ${productTable} where ${productTable.businessId} = ${businessTable}.${businessTable.id})`;

const ORDER_COUNT_SQL = sql<number>`(select count(*) from ${orderTable} where ${orderTable.businessId} = ${businessTable}.${businessTable.id})`;

/** Completed volume, in the business's own currency: cancelled orders never happened. */
const GROSS_VOLUME_SQL = sql<number>`(select coalesce(sum(${orderTable.totalMinor}), 0) from ${orderTable} where ${orderTable.businessId} = ${businessTable}.${businessTable.id} and ${orderTable.status} not in ('CANCELLED','REJECTED'))`;

const OWNER_NAME_SQL = sql<
	string | null
>`(select ${userTable}.${userTable.name} from ${membershipTable} inner join ${userTable} on ${userTable}.${userTable.id} = ${membershipTable}.${membershipTable.userId} where ${membershipTable}.${membershipTable.businessId} = ${businessTable}.${businessTable.id} and ${membershipTable}.${membershipTable.role} = 'OWNER' order by ${membershipTable}.${membershipTable.createdAt} asc limit 1)`;

const OWNER_EMAIL_SQL = sql<
	string | null
>`(select ${userTable}.${userTable.email} from ${membershipTable} inner join ${userTable} on ${userTable}.${userTable.id} = ${membershipTable}.${membershipTable.userId} where ${membershipTable}.${membershipTable.businessId} = ${businessTable}.${businessTable.id} and ${membershipTable}.${membershipTable.role} = 'OWNER' order by ${membershipTable}.${membershipTable.createdAt} asc limit 1)`;

/**
 * Why a business is suspended, read back from the audit entry that suspended it.
 *
 * `business` has no `suspendedReason` column, and the audit entry is the better home
 * for it anyway: it is a fact about an act, and an act has an actor and a time.
 */
const SUSPENDED_REASON_SQL = sql<
	string | null
>`(select json_extract(${auditLogTable}.${auditLogTable.meta}, '$.reason') from ${auditLogTable} where ${auditLogTable}.${auditLogTable.targetType} = 'business' and ${auditLogTable}.${auditLogTable.targetId} = ${businessTable}.${businessTable.id} and ${auditLogTable}.${auditLogTable.action} = 'business.suspend' order by ${auditLogTable}.${auditLogTable.createdAt} desc limit 1)`;

const ORDER_COUNT_BY_CUSTOMER_SQL = sql<number>`(select count(*) from ${orderTable} where ${orderTable.customerId} = ${userTable}.${userTable.id})`;

const TOTAL_SPENT_BY_CUSTOMER_SQL = sql<number>`(select coalesce(sum(${orderTable.totalMinor}), 0) from ${orderTable} where ${orderTable.customerId} = ${userTable}.${userTable.id} and ${orderTable.status} not in ('CANCELLED','REJECTED'))`;

const PRODUCT_COUNT_BY_CATEGORY_SQL = sql<number>`(select count(*) from ${productTable} where ${productTable.categoryId} = ${categoryTable}.${categoryTable.id})`;

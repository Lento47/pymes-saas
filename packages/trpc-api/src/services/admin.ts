import type { Db } from "@pymeshub/db";
import {
	auditLog as auditLogTable,
	business as businessTable,
	category as categoryTable,
	courierProfile as courierProfileTable,
	membership as membershipTable,
	orderEvent as orderEventTable,
	order as orderTable,
	payout as payoutTable,
	product as productTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type AdminAction,
	type AdminBusinessRow,
	type AdminCategoryInput,
	type AdminCourierListInput,
	type AdminCourierRow,
	type AdminListInput,
	type AdminMetrics,
	type AdminOrderRow,
	type AdminUserRow,
	type AuditLogEntry,
	type Category,
	canTransition,
	decodeCursor,
	newId,
	type Payout,
	REASON_REQUIRED_ACTIONS,
} from "@pymeshub/shared";
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
	sql,
} from "drizzle-orm";

import { ConflictError, ValidationError } from "../errors";
import type { UserContext } from "./helpers";
import { likePattern, orNotFound } from "./helpers";
import {
	adminBusinessRowOf,
	adminOrderRowOf,
	adminUserRowOf,
	auditLogEntryOf,
	categoryOf,
	currencyOf,
	payoutOf,
} from "./mappers";

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
// Payouts
// ---------------------------------------------------------------------------

export async function payouts(
	ctx: UserContext,
	input: AdminListInput,
): Promise<{ rows: Payout[]; total: number }> {
	const offset = offsetOf(input.cursor);
	const conditions = [];

	if (input.search)
		conditions.push(like(businessTable.name, likePattern(input.search)));
	if (input.from) conditions.push(gte(payoutTable.periodStart, input.from));
	if (input.to) conditions.push(lte(payoutTable.periodEnd, input.to));

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const direction = input.direction === "asc" ? sql`asc` : sql`desc`;

	const [rows, counted] = await Promise.all([
		ctx.db
			.select({
				payout: payoutTable,
				businessName: businessTable.name,
				currency: businessTable.currency,
			})
			.from(payoutTable)
			.innerJoin(businessTable, eq(payoutTable.businessId, businessTable.id))
			.where(where)
			.orderBy(
				sql`${payoutTable.periodStart} ${direction}`,
				asc(payoutTable.id),
			)
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(payoutTable)
			.innerJoin(businessTable, eq(payoutTable.businessId, businessTable.id))
			.where(where),
	]);

	const orderCounts = await orderCountsPerPayout(
		ctx.db,
		rows.map((row) => row.payout),
	);
	const references = await payoutReferencesFor(
		ctx.db,
		rows.map((row) => row.payout.id),
	);

	return {
		rows: rows.map((row) =>
			payoutOf(row.payout, {
				businessName: row.businessName,
				currency: currencyOf(row.currency),
				orderCount: orderCounts.get(row.payout.id) ?? 0,
				reference: references.get(row.payout.id) ?? null,
			}),
		),
		total: Number(counted[0]?.total ?? 0),
	};
}

/**
 * Mark a payout run as paid.
 *
 * The `reference` is the bank or SINPE reference the operator got back, and it exists
 * only here — there is no column for it, and putting it in the audit entry's `meta` is
 * what makes a payout reconcilable later. Recording that it happened is the point;
 * moving the money is not this system's job yet.
 */
export async function markPayoutPaid(
	ctx: UserContext,
	input: { payoutId: string; reference: string; reason?: string },
): Promise<Payout> {
	const reason = requireReason("payout.mark_paid", input.reason);

	const rows = await ctx.db
		.select({
			payout: payoutTable,
			businessName: businessTable.name,
			currency: businessTable.currency,
		})
		.from(payoutTable)
		.innerJoin(businessTable, eq(payoutTable.businessId, businessTable.id))
		.where(eq(payoutTable.id, input.payoutId))
		.limit(1);

	const row = orNotFound(rows[0]);
	if (row.payout.status === "PAID") {
		throw new ConflictError("Este pago ya fue registrado");
	}

	const now = new Date();

	await ctx.db.batch([
		ctx.db
			.update(payoutTable)
			.set({ status: "PAID", paidAt: now })
			.where(eq(payoutTable.id, input.payoutId)),
		auditStatement(ctx, {
			action: "payout.mark_paid",
			targetType: "payout",
			targetId: input.payoutId,
			before: { status: row.payout.status, paidAt: null },
			after: { status: "PAID", paidAt: now.toISOString() },
			reason,
			reference: input.reference,
			now,
		}),
	]);

	const orderCount =
		(await orderCountsPerPayout(ctx.db, [row.payout])).get(row.payout.id) ?? 0;

	return payoutOf(
		{ ...row.payout, status: "PAID", paidAt: now },
		{
			businessName: row.businessName,
			currency: currencyOf(row.currency),
			orderCount,
			reference: input.reference,
		},
	);
}

/**
 * The bank references of the payouts an admin marked paid, read back from the audit
 * entries.
 *
 * The payout table has no `reference` column, and adding one would be a migration for
 * a field only an operator ever writes. The audit entry that recorded the payment
 * already carries it, so reading it back is not a workaround — it is the same
 * append-only record, reached from the other side.
 *
 * Exported because `businesses.listPayouts` shows the same reference to the owner, and
 * two implementations of "where is the reference" is how one of them shows nothing.
 */
export async function payoutReferencesFor(
	db: Db,
	payoutIds: readonly string[],
): Promise<Map<string, string>> {
	const references = new Map<string, string>();
	if (payoutIds.length === 0) return references;

	const rows = await db
		.select({ targetId: auditLogTable.targetId, meta: auditLogTable.meta })
		.from(auditLogTable)
		.where(
			and(
				eq(auditLogTable.action, "payout.mark_paid"),
				inArray(auditLogTable.targetId, [...payoutIds]),
			),
		)
		.orderBy(asc(auditLogTable.createdAt));

	// Ascending, so a payout marked paid twice ends with the latest reference — the one
	// that matches the money that actually moved.
	for (const row of rows) {
		const meta = row.meta as { reference?: unknown } | null;
		if (typeof meta?.reference === "string")
			references.set(row.targetId, meta.reference);
	}

	return references;
}

/**
 * Orders per payout period.
 *
 * One read for every period in the page, then bucketed in memory, rather than a query
 * per payout: an admin table shows twenty-five of them, and twenty-five round trips
 * for a count is the shape that makes a console feel slow.
 */
async function orderCountsPerPayout(
	db: Db,
	spans: readonly { id: string; periodStart: Date; periodEnd: Date }[],
): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	if (spans.length === 0) return counts;

	const from = new Date(
		Math.min(...spans.map((span) => span.periodStart.getTime())),
	);
	const to = new Date(
		Math.max(...spans.map((span) => span.periodEnd.getTime())),
	);

	const rows = await db
		.select({ placedAt: orderTable.placedAt })
		.from(orderTable)
		.where(and(gte(orderTable.placedAt, from), lte(orderTable.placedAt, to)));

	for (const span of spans) {
		counts.set(
			span.id,
			rows.filter(
				(row) =>
					row.placedAt >= span.periodStart && row.placedAt <= span.periodEnd,
			).length,
		);
	}

	return counts;
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

		await ctx.db.batch([
			ctx.db
				.update(categoryTable)
				.set({
					name: input.name,
					nameEn,
					slug,
					iconName: input.iconName ?? before.iconName,
					parentId,
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
					sortOrder: before.sortOrder,
				},
				after: {
					name: input.name,
					nameEn,
					slug,
					parentId,
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
	input: { id: string },
): Promise<{ ok: true }> {
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
			reason: null,
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
// The audit write, and the reads the mutations share
// ---------------------------------------------------------------------------

/**
 * One audit row, as a statement the caller can put in a `batch`.
 *
 * Returning the statement rather than awaiting it is the whole point: the change and
 * the record of the change are then one atomic unit. An `await` here followed by the
 * update would leave a window where the platform suspended a business and has no
 * idea who did it.
 */
function auditStatement(
	ctx: UserContext,
	input: {
		action: AdminAction;
		targetType: string;
		targetId: string;
		before: unknown;
		after: unknown;
		reason: string | null;
		/** Only `payout.mark_paid` carries one; it is the reference the operator got back. */
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
 */
function requireReason(
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

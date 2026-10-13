import { idea as ideaTable } from "@pymeshub/db";
import {
	IDEA_ROLE,
	IDEA_STATUS,
	type Idea,
	type IdeaCreateInput,
	type IdeaListInput,
	type IdeaListMineInput,
	type IdeaResolveInput,
	type IdeaRole,
	type IdeaRow,
	type IdeaStatus,
	newId,
} from "@pymeshub/shared";
import {
	and,
	asc,
	desc,
	eq,
	inArray,
	like,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

import type { Membership } from "../context";
import { NotFoundError } from "../errors";
import { auditStatement } from "./audit";
import { likePattern, type UserContext } from "./helpers";

/**
 * Product feedback, as the console's queue works it.
 *
 * The contract is `packages/shared/src/schemas/idea.ts`. The router validates against
 * it, the console draws from it, and neither may invent a field this does not answer.
 *
 * **Unlike `support.ts`, nothing here reads an input id for a query.** Every merchant
 * procedure is `businessProcedure(...)`. An idea is the opposite case: a signed-in
 * user with no shop attached. There is no tenant to check, which is why `create` is
 * `protectedProcedure`.
 *
 * **`roleAtSubmit` and `businessId` are server-side decisions.** A client that could
 * name its role could file a customer idea as a merchant's. A client that could name
 * the shop could file against somebody else's.
 */

const LIVE_STATUSES: readonly IdeaStatus[] = ["OPEN"];

function assertKnownStatus(status: string): IdeaStatus {
	if (!(IDEA_STATUS as readonly string[]).includes(status)) {
		throw new Error(`idea has an unknown status: ${status}`);
	}
	return status as IdeaStatus;
}

function assertKnownRole(role: string): IdeaRole {
	if (!(IDEA_ROLE as readonly string[]).includes(role)) {
		throw new Error(`idea has an unknown role: ${role}`);
	}
	return role as IdeaRole;
}

/**
 * Who the submitter was, from the memberships this request already carries.
 *
 * MERCHANT if any non-courier membership, else COURIER if any courier membership,
 * else CUSTOMER. A person who owns a shop and also delivers is filing as a merchant,
 * because that is the membership that most changes what they see.
 */
export function roleAtSubmitOf(memberships: readonly Membership[]): IdeaRole {
	if (memberships.some((entry) => entry.role !== "COURIER")) return "MERCHANT";
	if (memberships.some((entry) => entry.role === "COURIER")) return "COURIER";
	return "CUSTOMER";
}

function ideaFields(row: typeof ideaTable.$inferSelect): Idea {
	return {
		id: row.id,
		userId: row.userId,
		businessId: row.businessId,
		roleAtSubmit: assertKnownRole(row.roleAtSubmit),
		subject: row.subject,
		body: row.body,
		status: assertKnownStatus(row.status),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		resolvedAt: row.resolvedAt,
	};
}

export async function create(
	ctx: UserContext,
	input: IdeaCreateInput,
): Promise<{ id: string; createdAt: Date }> {
	const now = new Date();
	const id = newId("idea");

	await ctx.db.insert(ideaTable).values({
		id,
		userId: ctx.user.id,
		businessId: ctx.memberships[0]?.businessId ?? null,
		roleAtSubmit: roleAtSubmitOf(ctx.memberships),
		subject: input.subject,
		body: input.body,
		status: "OPEN",
		createdAt: now,
		updatedAt: now,
	});

	return { id, createdAt: now };
}

export async function listMine(
	ctx: UserContext,
	input: IdeaListMineInput,
): Promise<{ rows: Idea[] }> {
	const conditions: (SQL | undefined)[] = [eq(ideaTable.userId, ctx.user.id)];
	if (input.status?.length) {
		conditions.push(inArray(ideaTable.status, [...input.status]));
	}

	const rows = await ctx.db
		.select()
		.from(ideaTable)
		.where(and(...conditions))
		.orderBy(desc(ideaTable.createdAt), asc(ideaTable.id))
		.limit(input.limit);

	return { rows: rows.map(ideaFields) };
}

type OffsetCursor = { offset: number };

function offsetOf(cursor: string | undefined): number {
	if (!cursor) return 0;
	const decoded = JSON.parse(cursor) as OffsetCursor | null;
	if (decoded && Number.isFinite(decoded.offset) && decoded.offset >= 0) {
		return Math.trunc(decoded.offset);
	}
	const plain = Number(cursor);
	return Number.isFinite(plain) && plain >= 0 ? Math.trunc(plain) : 0;
}

/**
 * The operator's queue.
 *
 * Both name lookups are correlated subqueries rather than inner joins: an idea whose
 * account was deleted has `user_id = NULL`, and an inner join would drop the row
 * before it could be returned.
 *
 * No `status` passed means the live ones.
 */
export async function list(
	ctx: UserContext,
	input: IdeaListInput,
): Promise<{ rows: IdeaRow[]; total: number }> {
	const conditions: (SQL | undefined)[] = [];

	conditions.push(
		input.status?.length
			? inArray(ideaTable.status, [...input.status])
			: inArray(ideaTable.status, [...LIVE_STATUSES]),
	);
	if (input.role?.length) {
		conditions.push(inArray(ideaTable.roleAtSubmit, [...input.role]));
	}
	if (input.search) {
		const pattern = likePattern(input.search);
		conditions.push(
			or(like(ideaTable.subject, pattern), like(ideaTable.body, pattern)),
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const offset = offsetOf(input.cursor);
	const sort =
		input.sort === "oldest"
			? sql`${ideaTable.createdAt} asc`
			: sql`${ideaTable.createdAt} desc`;

	const from = () =>
		ctx.db
			.select({
				idea: ideaTable,
				userName: sql<
					string | null
				>`(select name from user where id = ${ideaTable.userId})`,
				businessName: sql<
					string | null
				>`(select name from business where id = ${ideaTable.businessId})`,
			})
			.from(ideaTable);

	const [rows, counted] = await Promise.all([
		from()
			.where(where)
			.orderBy(sort, asc(ideaTable.id))
			.limit(input.limit)
			.offset(offset),
		ctx.db
			.select({ total: sql<number>`count(*)` })
			.from(ideaTable)
			.where(where),
	]);

	return {
		rows: rows.map((row) => ({
			...ideaFields(row.idea),
			userName: row.userName ?? null,
			businessName: row.businessName ?? null,
		})),
		total: Number(counted[0]?.total ?? 0),
	};
}

export async function get(
	ctx: UserContext,
	id: string,
): Promise<IdeaRow | null> {
	const [row] = await ctx.db
		.select({
			idea: ideaTable,
			userName: sql<
				string | null
			>`(select name from user where id = ${ideaTable.userId})`,
			businessName: sql<
				string | null
			>`(select name from business where id = ${ideaTable.businessId})`,
		})
		.from(ideaTable)
		.where(eq(ideaTable.id, id))
		.limit(1);

	if (!row) return null;
	return {
		...ideaFields(row.idea),
		userName: row.userName ?? null,
		businessName: row.businessName ?? null,
	};
}

export async function resolve(
	ctx: UserContext,
	input: IdeaResolveInput,
): Promise<{ id: string; status: IdeaStatus; createdAt: Date }> {
	const now = new Date();

	const existing = await ctx.db.query.idea.findFirst({
		where: eq(ideaTable.id, input.id),
	});
	if (!existing) throw new NotFoundError("Idea no encontrada");

	await ctx.db.batch([
		ctx.db
			.update(ideaTable)
			.set({
				status: input.status,
				resolvedAt: existing.resolvedAt ?? now,
				updatedAt: now,
			})
			.where(eq(ideaTable.id, input.id)),
		auditStatement(ctx, {
			action: "idea.resolve",
			targetType: "idea",
			targetId: input.id,
			before: { status: existing.status },
			after: { status: input.status, note: input.note },
			reason: input.note,
			now,
		}),
	]);

	return { id: input.id, status: input.status, createdAt: now };
}

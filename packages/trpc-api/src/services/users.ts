import {
	address as addressTable,
	business as businessTable,
	membership as membershipTable,
	notification as notificationTable,
	order as orderTable,
	user as userTable,
} from "@pymeshub/db";
import {
	type Address,
	type AddressInput,
	decodeCursor,
	encodeCursor,
	isTerminalStatus,
	type MembershipSummary,
	type Notification,
	type NotificationPrefs,
	type UpdatePreferencesInput,
	type UpdateProfileInput,
	type UserProfile,
} from "@pymeshub/shared";
import { and, desc, eq, lt, ne, notInArray, or } from "drizzle-orm";

import { ConflictError } from "../errors";
import type { UserContext } from "./helpers";
import { batchOf, orNotFound } from "./helpers";
import {
	addressOf,
	membershipSummaryOf,
	notificationOf,
	userProfileOf,
} from "./mappers";

/**
 * The caller's own surface: their profile, their addresses, their bell.
 *
 * Every function here takes no user id, and that is the design rather than a
 * simplification. `docs/api-surface.md` states it once — "no procedure takes a
 * `userId`" — and the reason is that the check and the query are then the same
 * statement. There is no version of `listAddresses` that reads another person's
 * addresses by getting an argument wrong, because there is no argument to get wrong.
 */

export type MeResult = UserProfile & { memberships: MembershipSummary[] };

/**
 * The profile, plus every business the caller belongs to.
 *
 * One procedure rather than two because both clients call it on cold start: the app
 * needs to know who it is and which business switcher to render before it draws
 * anything, and two round trips on a waking phone is a spinner where the second one
 * would have been.
 *
 * The profile is read from D1 rather than projected from `ctx.user`, because `ctx.user`
 * is typed as the narrow shape an authorisation decision needs and deliberately carries
 * no `createdAt` — which is a field this screen shows. `context.ts` has already resolved
 * this same row by the time this runs, so the read cannot miss.
 */
export async function me(ctx: UserContext): Promise<MeResult> {
	const rows = await ctx.db
		.select()
		.from(userTable)
		.where(eq(userTable.id, ctx.user.id))
		.limit(1);

	const profile = userProfileOf(orNotFound(rows[0]));

	const memberships = await ctx.db
		.select({
			businessId: membershipTable.businessId,
			businessName: businessTable.name,
			businessSlug: businessTable.slug,
			logoUrl: businessTable.logoUrl,
			role: membershipTable.role,
		})
		.from(membershipTable)
		.innerJoin(businessTable, eq(membershipTable.businessId, businessTable.id))
		.where(eq(membershipTable.userId, ctx.user.id));

	return {
		...profile,
		memberships: memberships.map(membershipSummaryOf),
	};
}

/**
 * Edit the fields the customer owns: their name, their phone, their avatar.
 *
 * Not their email and not their password. `user.email` is the sign-in identifier Better
 * Auth matches on and the credential lives in `auth_account`, so changing either from a
 * profile form would need a re-verification flow this app does not have — which is why
 * the shape of the input, not a check here, is what keeps the login out of reach.
 */
export async function updateProfile(
	ctx: UserContext,
	input: UpdateProfileInput,
): Promise<UserProfile> {
	const patch: Partial<typeof userTable.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.name !== undefined) patch.name = input.name;
	if (input.phone !== undefined) patch.phone = input.phone;
	if (input.image !== undefined) patch.image = input.image;

	await ctx.db
		.update(userTable)
		.set(patch)
		.where(eq(userTable.id, ctx.user.id));

	const rows = await ctx.db
		.select()
		.from(userTable)
		.where(eq(userTable.id, ctx.user.id))
		.limit(1);

	return userProfileOf(orNotFound(rows[0]));
}

/**
 * The three switches behind the settings screen, as the row holds them.
 *
 * Read and written through one pair of procedures rather than through `me`:
 * the cold-start read stays the profile plus memberships it has always been,
 * and a toggle is a small write that answers with what is stored rather than
 * with the whole row. An empty patch changes nothing and still answers the
 * row — "change nothing" is not an error, it is a request the answer to which
 * is the current state.
 */
export async function notificationPrefs(
	ctx: UserContext,
): Promise<NotificationPrefs> {
	const rows = await ctx.db
		.select({
			notifyOrderUpdates: userTable.notifyOrderUpdates,
			notifyReviewReplies: userTable.notifyReviewReplies,
			showReviewAvatar: userTable.showReviewAvatar,
		})
		.from(userTable)
		.where(eq(userTable.id, ctx.user.id))
		.limit(1);

	const prefs = orNotFound(rows[0]);
	return { ...prefs };
}

export async function updatePreferences(
	ctx: UserContext,
	input: UpdatePreferencesInput,
): Promise<NotificationPrefs> {
	const patch: Partial<typeof userTable.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.notifyOrderUpdates !== undefined)
		patch.notifyOrderUpdates = input.notifyOrderUpdates;
	if (input.notifyReviewReplies !== undefined)
		patch.notifyReviewReplies = input.notifyReviewReplies;
	if (input.showReviewAvatar !== undefined)
		patch.showReviewAvatar = input.showReviewAvatar;

	await ctx.db
		.update(userTable)
		.set(patch)
		.where(eq(userTable.id, ctx.user.id));

	return notificationPrefs(ctx);
}

export async function listAddresses(ctx: UserContext): Promise<Address[]> {
	const rows = await ctx.db
		.select()
		.from(addressTable)
		.where(eq(addressTable.userId, ctx.user.id));

	// The default first, then the rest as they were added. A list that reshuffles when
	// an address is edited is a list where the customer taps the wrong row.
	return rows
		.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
		.map(addressOf);
}

/**
 * Create or edit one of the caller's addresses.
 *
 * Three rules, and each is enforced here rather than in a screen:
 *
 * - **The first address is the default.** A customer with one address and no default
 *   is a checkout that has to ask a question with one possible answer.
 * - **At most one default.** Setting one clears the others in the same `batch`, so
 *   two addresses cannot both be the default — a state with no correct rendering.
 * - **An id that is not the caller's is not found.** The `where` carries the owner,
 *   so somebody else's address id resolves to nothing rather than to their row.
 */
export async function saveAddress(
	ctx: UserContext,
	input: AddressInput & { id?: string },
): Promise<Address> {
	if (input.id) {
		// Scoped by owner in the same statement that reads it. See `orNotFound`.
		const existing = await ctx.db
			.select()
			.from(addressTable)
			.where(
				and(
					eq(addressTable.id, input.id),
					eq(addressTable.userId, ctx.user.id),
				),
			)
			.limit(1);
		orNotFound(existing[0]);

		const statements = [
			ctx.db
				.update(addressTable)
				.set({
					label: input.label,
					line1: input.line1,
					line2: input.line2 ?? null,
					city: input.city,
					region: input.region,
					country: input.country,
					postalCode: input.postalCode ?? null,
					lat: input.lat ?? null,
					lng: input.lng ?? null,
					phone: input.phone ?? null,
					instructions: input.instructions ?? null,
					isDefault: input.isDefault,
				})
				.where(
					and(
						eq(addressTable.id, input.id),
						eq(addressTable.userId, ctx.user.id),
					),
				),
			...(input.isDefault
				? [
						ctx.db
							.update(addressTable)
							.set({ isDefault: false })
							.where(
								and(
									eq(addressTable.userId, ctx.user.id),
									ne(addressTable.id, input.id),
								),
							),
					]
				: []),
		];

		await ctx.db.batch(batchOf(statements));

		const updated = await ctx.db
			.select()
			.from(addressTable)
			.where(
				and(
					eq(addressTable.id, input.id),
					eq(addressTable.userId, ctx.user.id),
				),
			)
			.limit(1);
		return addressOf(orNotFound(updated[0]));
	}

	const owned = await ctx.db
		.select({ id: addressTable.id })
		.from(addressTable)
		.where(eq(addressTable.userId, ctx.user.id));

	// `input.isDefault || owned.length === 0`: an explicit request wins, and the first
	// address is the default whether or not the form said so.
	const isDefault = input.isDefault || owned.length === 0;
	const id = newAddressId();

	const statements = [
		ctx.db.insert(addressTable).values({
			id,
			userId: ctx.user.id,
			label: input.label,
			line1: input.line1,
			line2: input.line2 ?? null,
			city: input.city,
			region: input.region,
			country: input.country,
			postalCode: input.postalCode ?? null,
			lat: input.lat ?? null,
			lng: input.lng ?? null,
			phone: input.phone ?? null,
			instructions: input.instructions ?? null,
			isDefault,
		}),
		...(isDefault && owned.length > 0
			? [
					ctx.db
						.update(addressTable)
						.set({ isDefault: false })
						.where(
							and(
								eq(addressTable.userId, ctx.user.id),
								ne(addressTable.id, id),
							),
						),
				]
			: []),
	];

	await ctx.db.batch(batchOf(statements));

	const created = await ctx.db
		.select()
		.from(addressTable)
		.where(eq(addressTable.id, id))
		.limit(1);
	return addressOf(orNotFound(created[0]));
}

/**
 * Remove an address, unless an order still needs it.
 *
 * Refused rather than orphaned, and refused rather than silently detached: an order
 * whose `addressId` was set to null is a delivery that has lost its destination, and
 * the failure would surface as a driver with no address rather than as an error the
 * customer can act on. The order's own copy of the address is not kept — that is a
 * column this schema does not have — so the row has to stay until the order ends.
 *
 * "Live" is `isTerminalStatus` from the shared state machine, not a list of statuses
 * typed here: a status added to the machine later must be classified by the machine,
 * not missed by a copy of it.
 */
export async function deleteAddress(
	ctx: UserContext,
	input: { id: string },
): Promise<{ ok: true }> {
	const owned = await ctx.db
		.select()
		.from(addressTable)
		.where(
			and(eq(addressTable.id, input.id), eq(addressTable.userId, ctx.user.id)),
		)
		.limit(1);
	orNotFound(owned[0]);

	const live = await ctx.db
		.select({ id: orderTable.id, status: orderTable.status })
		.from(orderTable)
		.where(
			and(
				eq(orderTable.addressId, input.id),
				eq(orderTable.customerId, ctx.user.id),
			),
		);

	if (live.some((order) => !isTerminalStatus(order.status))) {
		throw new ConflictError("Tienes un pedido en curso con esta dirección", {
			orderId: live.find((order) => !isTerminalStatus(order.status))?.id,
		});
	}

	await ctx.db
		.delete(addressTable)
		.where(
			and(eq(addressTable.id, input.id), eq(addressTable.userId, ctx.user.id)),
		);

	return { ok: true };
}

/** Minted here rather than in `@pymeshub/shared/ids` so a client can never choose one. */
function newAddressId(): string {
	return `adr_${crypto.randomUUID()}`;
}

/**
 * Kinds the bell must not show.
 *
 * `ORDER_REQUEST` is the order-idempotency ledger, written into this table because
 * the unique index it needs is the one `dedupe_key` carries. It is addressed to the
 * customer and it is *about* their own order, so it would appear in their list as a
 * notification saying nothing. One constant, filtered in one place — a ledger row
 * that leaks into a customer's bell is the kind of bug that is only noticed by a
 * customer.
 */
const INTERNAL_NOTIFICATION_KINDS = ["ORDER_REQUEST"];

export async function listNotifications(
	ctx: UserContext,
	input: { cursor?: string; limit: number },
): Promise<{ items: Notification[]; nextCursor: string | null }> {
	const after = decodeCursor<{ at: number; id: string }>(input.cursor);

	const conditions = [
		eq(notificationTable.userId, ctx.user.id),
		notInArray(notificationTable.kind, INTERNAL_NOTIFICATION_KINDS),
	];

	const page = await ctx.db
		.select()
		.from(notificationTable)
		.where(
			after
				? and(
						...conditions,
						or(
							lt(notificationTable.createdAt, new Date(after.at)),
							and(
								eq(notificationTable.createdAt, new Date(after.at)),
								lt(notificationTable.id, after.id),
							),
						),
					)
				: and(...conditions),
		)
		.orderBy(desc(notificationTable.createdAt), desc(notificationTable.id))
		// One extra row, read to answer "is there a next page" without a second count.
		.limit(input.limit + 1);

	const hasMore = page.length > input.limit;
	const items = hasMore ? page.slice(0, input.limit) : page;
	const last = items[items.length - 1];

	return {
		items: items.map(notificationOf),
		nextCursor:
			hasMore && last
				? encodeCursor({ at: last.createdAt.getTime(), id: last.id })
				: null,
	};
}

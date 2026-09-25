import {
	business as businessTable,
	courierInvite as inviteTable,
	membership as membershipTable,
	courierProfile as profileTable,
	user as userTable,
} from "@pymeshub/db";
import type {
	CourierBusinessInvitesInput,
	CourierCancelInviteInput,
	CourierDirectoryEntry,
	CourierDirectoryInput,
	CourierInvite,
	CourierInviteInput,
	CourierProfile,
	CourierProfileInput,
	CourierRespondInput,
} from "@pymeshub/shared";
import { newId } from "@pymeshub/shared";
import {
	and,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	like,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { ConflictError, ValidationError } from "../errors";
import type { BusinessContext, UserContext } from "./helpers";
import { likePattern, orNotFound } from "./helpers";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_BUSINESS_INVITES = 20;
const MAX_PENDING_COURIER_INVITES = 20;

type ProfileRow = typeof profileTable.$inferSelect;
type InviteRow = typeof inviteTable.$inferSelect;

function profileOf(row: ProfileRow): CourierProfile {
	return {
		id: row.id,
		userId: row.userId,
		displayName: row.displayName,
		serviceArea: row.serviceArea,
		bio: row.bio,
		vehicleName: row.vehicleName,
		vehiclePlate: row.vehiclePlate,
		vehiclePhotoUrl: row.vehiclePhotoUrl,
		isAvailable: row.isAvailable,
		verificationStatus: row.verificationStatus,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function inviteOf(
	row: InviteRow,
	business: { name: string; logoUrl: string | null },
	profile: { displayName: string },
): CourierInvite {
	return {
		id: row.id,
		businessId: row.businessId,
		businessName: business.name,
		businessLogoUrl: business.logoUrl,
		courierUserId: row.courierUserId,
		courierName: profile.displayName,
		profileId: row.profileId,
		status: row.status,
		createdAt: row.createdAt,
		expiresAt: row.expiresAt,
		respondedAt: row.respondedAt,
	};
}

/** The caller's own opt-in courier profile, or null before they create one. */
export async function myProfile(
	ctx: UserContext,
): Promise<CourierProfile | null> {
	const rows = await ctx.db
		.select()
		.from(profileTable)
		.where(eq(profileTable.userId, ctx.user.id))
		.limit(1);
	return rows[0] ? profileOf(rows[0]) : null;
}

/**
 * Create or edit the caller's public courier profile.
 *
 * A meaningful edit returns a reviewed profile to PENDING. Availability is
 * the exception: a courier turning off for the day must not have to wait for a
 * platform review before turning back on.
 */
export async function saveProfile(
	ctx: UserContext,
	input: CourierProfileInput,
): Promise<CourierProfile> {
	const rows = await ctx.db
		.select()
		.from(profileTable)
		.where(eq(profileTable.userId, ctx.user.id))
		.limit(1);
	const current = rows[0];
	const now = new Date();
	const bio = input.bio?.trim() || null;
	const vehicleName = input.vehicleName?.trim() || null;
	const vehiclePlate = input.vehiclePlate?.trim() || null;
	const vehiclePhotoUrl = input.vehiclePhotoUrl?.trim() || null;
	const meaningfulChange =
		!current ||
		current.displayName !== input.displayName ||
		current.serviceArea !== input.serviceArea ||
		current.bio !== bio ||
		current.vehicleName !== vehicleName ||
		current.vehiclePlate !== vehiclePlate ||
		current.vehiclePhotoUrl !== vehiclePhotoUrl;

	if (current) {
		const status = meaningfulChange ? "PENDING" : current.verificationStatus;
		await ctx.db
			.update(profileTable)
			.set({
				displayName: input.displayName,
				serviceArea: input.serviceArea,
				bio,
				vehicleName,
				vehiclePlate,
				vehiclePhotoUrl,
				isAvailable: input.isAvailable,
				verificationStatus: status,
				updatedAt: now,
			})
			.where(eq(profileTable.id, current.id));
		return profileOf({
			...current,
			displayName: input.displayName,
			serviceArea: input.serviceArea,
			bio,
			vehicleName,
			vehiclePlate,
			vehiclePhotoUrl,
			isAvailable: input.isAvailable,
			verificationStatus: status,
			updatedAt: now,
		});
	}

	const id = newId("courierProfile");
	await ctx.db.insert(profileTable).values({
		id,
		userId: ctx.user.id,
		displayName: input.displayName,
		serviceArea: input.serviceArea,
		bio,
		vehicleName,
		vehiclePlate,
		vehiclePhotoUrl,
		isAvailable: input.isAvailable,
		verificationStatus: "PENDING",
		createdAt: now,
		updatedAt: now,
	});

	return {
		id,
		userId: ctx.user.id,
		displayName: input.displayName,
		serviceArea: input.serviceArea,
		bio,
		vehicleName,
		vehiclePlate,
		vehiclePhotoUrl,
		isAvailable: input.isAvailable,
		verificationStatus: "PENDING",
		createdAt: now,
		updatedAt: now,
	};
}

/**
 * Search only reviewed, available profiles. The query deliberately has no
 * email/phone lookup: this is a directory of people who opted in, not a way to
 * discover whether an arbitrary account exists.
 */
export async function directory(
	ctx: BusinessContext,
	input: CourierDirectoryInput,
): Promise<CourierDirectoryEntry[]> {
	const rows = await ctx.db
		.select({ profile: profileTable, image: userTable.image })
		.from(profileTable)
		.innerJoin(userTable, eq(profileTable.userId, userTable.id))
		.where(
			and(
				eq(profileTable.verificationStatus, "VERIFIED"),
				eq(profileTable.isAvailable, true),
				isNull(userTable.suspendedAt),
				or(
					like(profileTable.displayName, likePattern(input.search)),
					like(profileTable.serviceArea, likePattern(input.search)),
				),
			),
		)
		.orderBy(desc(profileTable.updatedAt))
		.limit(20);

	if (rows.length === 0) return [];
	const userIds = rows.map((row) => row.profile.userId);
	const [members, invites] = await Promise.all([
		ctx.db
			.select({ userId: membershipTable.userId })
			.from(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, ctx.membership.businessId),
					inArray(membershipTable.userId, userIds),
				),
			),
		ctx.db
			.select({ userId: inviteTable.courierUserId })
			.from(inviteTable)
			.where(
				and(
					eq(inviteTable.businessId, ctx.membership.businessId),
					eq(inviteTable.status, "PENDING"),
					gt(inviteTable.expiresAt, new Date()),
					inArray(inviteTable.courierUserId, userIds),
				),
			),
	]);
	const memberIds = new Set(members.map((row) => row.userId));
	const invitedIds = new Set(invites.map((row) => row.userId));

	return rows.map(({ profile, image }) => ({
		profileId: profile.id,
		displayName: profile.displayName,
		image,
		serviceArea: profile.serviceArea,
		bio: profile.bio,
		isAvailable: profile.isAvailable,
		isVerified: true,
		isMember: memberIds.has(profile.userId),
		isInvited: invitedIds.has(profile.userId),
	}));
}

/** Create a pending invitation. It does not grant access. */
export async function invite(
	ctx: BusinessContext,
	input: CourierInviteInput,
): Promise<CourierInvite> {
	const profileRows = await ctx.db
		.select({ profile: profileTable, user: userTable })
		.from(profileTable)
		.innerJoin(userTable, eq(profileTable.userId, userTable.id))
		.where(eq(profileTable.id, input.profileId))
		.limit(1);
	const row = orNotFound(profileRows[0]);

	if (
		row.profile.verificationStatus !== "VERIFIED" ||
		!row.profile.isAvailable
	) {
		throw new ValidationError(
			"Este repartidor todavía no está disponible para recibir invitaciones",
		);
	}
	if (row.user.suspendedAt) {
		throw new ValidationError("Esta cuenta está suspendida");
	}

	const now = new Date();
	await ctx.db
		.update(inviteTable)
		.set({ status: "EXPIRED", respondedAt: now })
		.where(
			and(
				eq(inviteTable.businessId, ctx.membership.businessId),
				eq(inviteTable.courierUserId, row.profile.userId),
				eq(inviteTable.status, "PENDING"),
				lte(inviteTable.expiresAt, now),
			),
		);

	const [memberships, existingInvites, businessCount, courierCount] =
		await Promise.all([
			ctx.db
				.select({ id: membershipTable.id })
				.from(membershipTable)
				.where(
					and(
						eq(membershipTable.businessId, ctx.membership.businessId),
						eq(membershipTable.userId, row.profile.userId),
					),
				)
				.limit(1),
			ctx.db
				.select({ id: inviteTable.id })
				.from(inviteTable)
				.where(
					and(
						eq(inviteTable.businessId, ctx.membership.businessId),
						eq(inviteTable.courierUserId, row.profile.userId),
						eq(inviteTable.status, "PENDING"),
						gt(inviteTable.expiresAt, new Date()),
					),
				)
				.limit(1),
			ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(inviteTable)
				.where(
					and(
						eq(inviteTable.businessId, ctx.membership.businessId),
						eq(inviteTable.status, "PENDING"),
						gt(inviteTable.expiresAt, new Date()),
					),
				),
			ctx.db
				.select({ count: sql<number>`count(*)` })
				.from(inviteTable)
				.where(
					and(
						eq(inviteTable.courierUserId, row.profile.userId),
						eq(inviteTable.status, "PENDING"),
						gt(inviteTable.expiresAt, new Date()),
					),
				),
		]);

	if (memberships[0]) {
		throw new ConflictError("Esta persona ya forma parte del equipo");
	}
	if (existingInvites[0]) {
		throw new ConflictError("Esta persona ya tiene una invitación pendiente");
	}
	if (Number(businessCount[0]?.count ?? 0) >= MAX_PENDING_BUSINESS_INVITES) {
		throw new ValidationError(
			"Este negocio tiene demasiadas invitaciones pendientes",
		);
	}
	if (Number(courierCount[0]?.count ?? 0) >= MAX_PENDING_COURIER_INVITES) {
		throw new ValidationError(
			"Esta persona tiene demasiadas invitaciones pendientes",
		);
	}

	const id = newId("courierInvite");
	await ctx.db.insert(inviteTable).values({
		id,
		businessId: ctx.membership.businessId,
		courierUserId: row.profile.userId,
		profileId: row.profile.id,
		invitedByUserId: ctx.user.id,
		status: "PENDING",
		expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
		createdAt: now,
	});

	const businessRows = await ctx.db
		.select({ name: businessTable.name, logoUrl: businessTable.logoUrl })
		.from(businessTable)
		.where(eq(businessTable.id, ctx.membership.businessId))
		.limit(1);
	const business = orNotFound(businessRows[0]);

	return inviteOf(
		{
			id,
			businessId: ctx.membership.businessId,
			courierUserId: row.profile.userId,
			profileId: row.profile.id,
			invitedByUserId: ctx.user.id,
			status: "PENDING",
			expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
			respondedAt: null,
			createdAt: now,
		},
		business,
		row.profile,
	);
}

/** Invitations addressed to the signed-in courier. */
export async function myInvites(ctx: UserContext): Promise<CourierInvite[]> {
	const rows = await ctx.db
		.select({
			invite: inviteTable,
			business: businessTable,
			profile: profileTable,
		})
		.from(inviteTable)
		.innerJoin(businessTable, eq(inviteTable.businessId, businessTable.id))
		.innerJoin(profileTable, eq(inviteTable.profileId, profileTable.id))
		.where(eq(inviteTable.courierUserId, ctx.user.id))
		.orderBy(desc(inviteTable.createdAt));

	const now = new Date();
	return rows.map((row) =>
		inviteOf(
			{
				...row.invite,
				status:
					row.invite.status === "PENDING" && row.invite.expiresAt <= now
						? "EXPIRED"
						: row.invite.status,
			},
			row.business,
			row.profile,
		),
	);
}

/** Pending invitations a business has sent. */
export async function businessInvites(
	ctx: BusinessContext,
	input: CourierBusinessInvitesInput,
): Promise<CourierInvite[]> {
	void input;
	const rows = await ctx.db
		.select({
			invite: inviteTable,
			business: businessTable,
			profile: profileTable,
		})
		.from(inviteTable)
		.innerJoin(businessTable, eq(inviteTable.businessId, businessTable.id))
		.innerJoin(profileTable, eq(inviteTable.profileId, profileTable.id))
		.where(
			and(
				eq(inviteTable.businessId, ctx.membership.businessId),
				eq(inviteTable.status, "PENDING"),
				gt(inviteTable.expiresAt, new Date()),
			),
		)
		.orderBy(desc(inviteTable.createdAt));

	return rows.map((row) => inviteOf(row.invite, row.business, row.profile));
}

/** Accept or decline an invitation addressed to the caller. */
export async function respond(
	ctx: UserContext,
	input: CourierRespondInput,
): Promise<CourierInvite> {
	const rows = await ctx.db
		.select({
			invite: inviteTable,
			business: businessTable,
			profile: profileTable,
		})
		.from(inviteTable)
		.innerJoin(businessTable, eq(inviteTable.businessId, businessTable.id))
		.innerJoin(profileTable, eq(inviteTable.profileId, profileTable.id))
		.where(
			and(
				eq(inviteTable.id, input.inviteId),
				eq(inviteTable.courierUserId, ctx.user.id),
			),
		)
		.limit(1);
	const row = orNotFound(rows[0]);
	const now = new Date();

	if (row.invite.status !== "PENDING") {
		throw new ConflictError("Esta invitación ya no está pendiente");
	}
	if (row.invite.expiresAt <= now) {
		await ctx.db
			.update(inviteTable)
			.set({ status: "EXPIRED", respondedAt: now })
			.where(eq(inviteTable.id, row.invite.id));
		throw new ConflictError("Esta invitación expiró");
	}

	if (input.response === "DECLINED") {
		const declined = await ctx.db
			.update(inviteTable)
			.set({ status: "DECLINED", respondedAt: now })
			.where(
				and(
					eq(inviteTable.id, row.invite.id),
					eq(inviteTable.status, "PENDING"),
				),
			)
			.returning({ id: inviteTable.id });
		if (!declined[0]) {
			throw new ConflictError("Esta invitación ya no está pendiente");
		}
		return inviteOf(
			{ ...row.invite, status: "DECLINED", respondedAt: now },
			row.business,
			row.profile,
		);
	}

	if (
		row.profile.verificationStatus !== "VERIFIED" ||
		!row.profile.isAvailable
	) {
		throw new ValidationError(
			"Tu perfil de repartidor necesita estar disponible y verificado",
		);
	}

	const existing = await ctx.db
		.select({ id: membershipTable.id })
		.from(membershipTable)
		.where(
			and(
				eq(membershipTable.businessId, row.invite.businessId),
				eq(membershipTable.userId, ctx.user.id),
			),
		)
		.limit(1);
	if (existing[0]) {
		throw new ConflictError("Ya formas parte de este equipo");
	}

	const claimed = await ctx.db
		.update(inviteTable)
		.set({ status: "ACCEPTED", respondedAt: now })
		.where(
			and(eq(inviteTable.id, row.invite.id), eq(inviteTable.status, "PENDING")),
		)
		.returning({ id: inviteTable.id });
	if (!claimed[0]) {
		throw new ConflictError("Esta invitación ya no está pendiente");
	}

	try {
		await ctx.db.insert(membershipTable).values({
			id: newId("membership"),
			businessId: row.invite.businessId,
			userId: ctx.user.id,
			role: "COURIER",
			createdAt: now,
		});
	} catch (error) {
		// A concurrent acceptance may already have created the membership. If so,
		// the accepted invitation is the truthful final state. Otherwise put the
		// invitation back so a transient write failure is retryable.
		const membership = await ctx.db
			.select({ id: membershipTable.id })
			.from(membershipTable)
			.where(
				and(
					eq(membershipTable.businessId, row.invite.businessId),
					eq(membershipTable.userId, ctx.user.id),
				),
			)
			.limit(1);
		if (membership[0]) {
			return inviteOf(
				{ ...row.invite, status: "ACCEPTED", respondedAt: now },
				row.business,
				row.profile,
			);
		}
		await ctx.db
			.update(inviteTable)
			.set({ status: "PENDING", respondedAt: null })
			.where(
				and(
					eq(inviteTable.id, row.invite.id),
					eq(inviteTable.status, "ACCEPTED"),
				),
			);
		throw error;
	}

	return inviteOf(
		{ ...row.invite, status: "ACCEPTED", respondedAt: now },
		row.business,
		row.profile,
	);
}

/** A manager or owner can withdraw a pending invitation. */
export async function cancel(
	ctx: BusinessContext,
	input: CourierCancelInviteInput,
): Promise<{ ok: true }> {
	const rows = await ctx.db
		.select({ id: inviteTable.id, status: inviteTable.status })
		.from(inviteTable)
		.where(
			and(
				eq(inviteTable.id, input.inviteId),
				eq(inviteTable.businessId, ctx.membership.businessId),
			),
		)
		.limit(1);
	const row = orNotFound(rows[0]);
	if (row.status !== "PENDING") {
		throw new ConflictError("Esta invitación ya no está pendiente");
	}
	const cancelled = await ctx.db
		.update(inviteTable)
		.set({ status: "CANCELLED", respondedAt: new Date() })
		.where(
			and(
				eq(inviteTable.id, input.inviteId),
				eq(inviteTable.status, "PENDING"),
			),
		)
		.returning({ id: inviteTable.id });
	if (!cancelled[0]) {
		throw new ConflictError("Esta invitación ya no está pendiente");
	}
	return { ok: true };
}

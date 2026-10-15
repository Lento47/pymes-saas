import {
	business,
	merchantDashboardPreference,
	mobileShopAppearance,
} from "@pymeshub/db";
import {
	brandAccentCheck,
	type DashboardPreferences,
	DEFAULT_DASHBOARD_PREFERENCES,
	DEFAULT_STOREFRONT_APPEARANCE,
	newId,
	resolveDashboardPreferences,
	resolveStorefrontAppearance,
	type StorefrontAppearance,
} from "@pymeshub/shared";
import { and, eq, exists, sql } from "drizzle-orm";
import { ConflictError, ForbiddenError, ValidationError } from "../errors";
import type { BusinessContext } from "./helpers";

function merchantOnly(ctx: BusinessContext) {
	if (ctx.membership.role === "COURIER") throw new ForbiddenError();
}

export async function readDashboard(ctx: BusinessContext) {
	merchantOnly(ctx);
	const [row] = await ctx.db
		.select()
		.from(merchantDashboardPreference)
		.where(
			and(
				eq(merchantDashboardPreference.businessId, ctx.membership.businessId),
				eq(merchantDashboardPreference.userId, ctx.user.id),
			),
		)
		.limit(1);
	return {
		configuration: resolveDashboardPreferences(row?.configuration),
		revision: row?.revision ?? 0,
	};
}

export async function saveDashboard(
	ctx: BusinessContext,
	configuration: DashboardPreferences,
	revision: number,
) {
	merchantOnly(ctx);
	const businessId = ctx.membership.businessId;
	const userId = ctx.user.id;
	const now = new Date();
	if (revision === 0) {
		const inserted = await ctx.db
			.insert(merchantDashboardPreference)
			.values({
				id: newId("dashboardPreference"),
				businessId,
				userId,
				configuration,
				revision: 1,
				updatedAt: now,
			})
			.onConflictDoNothing()
			.returning({ revision: merchantDashboardPreference.revision });
		if (inserted.length) return { configuration, revision: 1 };
	} else {
		const updated = await ctx.db
			.update(merchantDashboardPreference)
			.set({ configuration, revision: revision + 1, updatedAt: now })
			.where(
				and(
					eq(merchantDashboardPreference.businessId, businessId),
					eq(merchantDashboardPreference.userId, userId),
					eq(merchantDashboardPreference.revision, revision),
				),
			)
			.returning({ revision: merchantDashboardPreference.revision });
		if (updated.length) return { configuration, revision: revision + 1 };
	}
	throw new ConflictError(
		"El diseño cambió en otro dispositivo. Actualiza antes de guardar.",
	);
}

export async function readShop(ctx: BusinessContext) {
	const [row] = await ctx.db
		.select()
		.from(mobileShopAppearance)
		.where(eq(mobileShopAppearance.businessId, ctx.membership.businessId))
		.limit(1);
	return {
		published: resolveStorefrontAppearance(row?.published),
		draft: row?.draft ? resolveStorefrontAppearance(row.draft) : null,
		revision: row?.revision ?? 0,
	};
}

async function changeShop(
	ctx: BusinessContext,
	revision: number,
	values: {
		draft?: StorefrontAppearance | null;
		published?: StorefrontAppearance | null;
	},
) {
	const businessId = ctx.membership.businessId;
	const now = new Date();
	if (revision === 0) {
		const inserted = await ctx.db
			.insert(mobileShopAppearance)
			.values({
				businessId,
				draft: values.draft ?? null,
				published: values.published ?? null,
				revision: 1,
				updatedAt: now,
			})
			.onConflictDoNothing()
			.returning({ revision: mobileShopAppearance.revision });
		if (inserted.length) return readShop(ctx);
	} else {
		const updated = await ctx.db
			.update(mobileShopAppearance)
			.set({ ...values, revision: revision + 1, updatedAt: now })
			.where(
				and(
					eq(mobileShopAppearance.businessId, businessId),
					eq(mobileShopAppearance.revision, revision),
				),
			)
			.returning({ revision: mobileShopAppearance.revision });
		if (updated.length) return readShop(ctx);
	}
	throw new ConflictError(
		"El diseño cambió en otro dispositivo. Actualiza antes de continuar.",
	);
}

export async function saveShopDraft(
	ctx: BusinessContext,
	configuration: StorefrontAppearance,
	revision: number,
) {
	if (configuration.accentColor) {
		const result = brandAccentCheck(configuration.accentColor);
		if (!result.valid)
			throw new ValidationError(
				"El color no se distingue bien en ambos temas. Usa el tono sugerido.",
				{ suggestedColor: result.suggested },
			);
	}
	return changeShop(ctx, revision, { draft: configuration });
}

export async function publishShop(ctx: BusinessContext, revision: number) {
	const current = await readShop(ctx);
	if (!current.draft)
		throw new ValidationError("Guarda un borrador antes de publicarlo.");
	if (current.revision !== revision)
		throw new ConflictError(
			"El diseño cambió en otro dispositivo. Actualiza antes de publicar.",
		);
	const { logoUrl, coverUrl, ...appearance } = current.draft;
	if (logoUrl === undefined && coverUrl === undefined)
		return changeShop(ctx, revision, { published: appearance, draft: null });
	const businessId = ctx.membership.businessId;
	const now = new Date();
	// Both writes share the revision guard and one transaction. A stale publish
	// cannot change photos, and a failed design write cannot publish photos alone.
	const revisionMatches = and(
		eq(mobileShopAppearance.businessId, businessId),
		eq(mobileShopAppearance.revision, revision),
	);
	const [, updated] = await ctx.db.batch([
		ctx.db
			.update(business)
			.set({
				...(logoUrl !== undefined ? { logoUrl } : {}),
				...(coverUrl !== undefined ? { coverUrl } : {}),
				updatedAt: now,
			})
			.where(
				and(
					eq(business.id, businessId),
					exists(
						ctx.db
							.select({ one: sql`1` })
							.from(mobileShopAppearance)
							.where(revisionMatches),
					),
				),
			),
		ctx.db
			.update(mobileShopAppearance)
			.set({
				published: appearance,
				draft: null,
				revision: revision + 1,
				updatedAt: now,
			})
			.where(revisionMatches)
			.returning({ revision: mobileShopAppearance.revision }),
	]);
	if (!updated.length)
		throw new ConflictError(
			"El diseño cambió en otro dispositivo. Actualiza antes de publicar.",
		);
	return readShop(ctx);
}

export async function discardShopDraft(ctx: BusinessContext, revision: number) {
	return changeShop(ctx, revision, { draft: null });
}

export async function restoreShopDefault(
	ctx: BusinessContext,
	revision: number,
) {
	return changeShop(ctx, revision, { draft: DEFAULT_STOREFRONT_APPEARANCE });
}

export async function restoreDashboardDefault(
	ctx: BusinessContext,
	revision: number,
) {
	return saveDashboard(ctx, DEFAULT_DASHBOARD_PREFERENCES, revision);
}

import { deliveryPricingPolicy as policy, user } from "@pymeshub/db";
import {
	DEFAULT_DELIVERY_PRICING_TERMS,
	type deliveryPricingDraftInput,
	deliveryPricingTermsSchema,
	type publishDeliveryPricingInput,
	type simulateDeliveryPricingInput,
} from "@pymeshub/shared";
import { and, desc, eq, lte, ne } from "drizzle-orm";
import type { z } from "zod";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../errors";
import { auditStatement, requireReason } from "./audit";
import { EXPRESS_V1, priceBreakdown } from "./delivery-pricing";
import type { UserContext } from "./helpers";

type PolicyRow = typeof policy.$inferSelect;
const market = eq(policy.marketCode, "CR");
const published = and(market, ne(policy.status, "DRAFT"));

export async function canManagePricing(ctx: UserContext): Promise<boolean> {
	const [actor] = await ctx.db
		.select({
			isAdmin: user.isAdmin,
			allowed: user.canManagePricing,
			suspendedAt: user.suspendedAt,
		})
		.from(user)
		.where(eq(user.id, ctx.user.id))
		.limit(1);
	return Boolean(actor?.isAdmin && actor.allowed && !actor.suspendedAt);
}
async function requirePricingManager(ctx: UserContext) {
	if (!(await canManagePricing(ctx)))
		throw new ForbiddenError(
			"Se requiere el permiso Super Admin: pricing.manage",
		);
}
async function head(ctx: UserContext) {
	const [row] = await ctx.db
		.select()
		.from(policy)
		.where(published)
		.orderBy(desc(policy.revision))
		.limit(1);
	return row;
}

/** Retired history still serves the current terms while a future publication is scheduled. */
export async function activeDeliveryPricing(
	ctx: UserContext,
	now = new Date(),
) {
	const [row] = await ctx.db
		.select()
		.from(policy)
		.where(and(published, lte(policy.activeFrom, now)))
		.orderBy(desc(policy.activeFrom), desc(policy.revision))
		.limit(1);
	return row
		? {
				version: row.version,
				terms: deliveryPricingTermsSchema.parse(row.terms),
			}
		: { version: EXPRESS_V1.version, terms: DEFAULT_DELIVERY_PRICING_TERMS };
}

export async function pricingPolicy(ctx: UserContext) {
	if (!ctx.user.isAdmin) throw new ForbiddenError();
	const [active, latest, allowed, rows] = await Promise.all([
		activeDeliveryPricing(ctx),
		head(ctx),
		canManagePricing(ctx),
		ctx.db
			.select()
			.from(policy)
			.where(market)
			.orderBy(desc(policy.createdAt))
			.limit(30),
	]);
	return {
		active,
		headVersion: latest?.version ?? EXPRESS_V1.version,
		canManage: allowed,
		rows,
	};
}

export async function simulatePricingPolicy(
	ctx: UserContext,
	input: z.infer<typeof simulateDeliveryPricingInput>,
) {
	await requirePricingManager(ctx);
	const terms = deliveryPricingTermsSchema.parse(input.terms);
	const result = priceBreakdown({
		...input,
		terms,
		policyVersion: "simulation",
		merchantCoversDelivery: false,
	});
	return {
		...result,
		exceedsCap:
			terms.customerPriceCapCRC !== null &&
			result.customerFeeCRC > terms.customerPriceCapCRC,
	};
}

export async function savePricingPolicyDraft(
	ctx: UserContext,
	input: z.infer<typeof deliveryPricingDraftInput>,
) {
	await requirePricingManager(ctx);
	const latest = await head(ctx);
	if ((latest?.version ?? EXPRESS_V1.version) !== input.expectedVersion)
		throw new ConflictError(
			"Las tarifas cambiaron. Actualiza antes de guardar.",
		);
	const now = new Date();
	const id = `dpp_${crypto.randomUUID()}`;
	const row: PolicyRow = {
		id,
		marketCode: "CR",
		version: `express-${crypto.randomUUID()}`,
		previousVersion: input.expectedVersion,
		revision: 0,
		status: "DRAFT",
		terms: deliveryPricingTermsSchema.parse(input.terms),
		createdByAdminId: ctx.user.id,
		approvedReason: requireReason("pricing.draft", input.reason),
		createdAt: now,
		activeFrom: input.activeFrom ?? now,
	};
	if (latest && row.activeFrom < latest.activeFrom)
		throw new ValidationError(
			"La vigencia debe comenzar después de la última publicación programada.",
		);
	await ctx.db.batch([
		ctx.db.insert(policy).values(row),
		auditStatement(ctx, {
			action: "pricing.draft",
			targetType: "delivery_pricing_policy",
			targetId: id,
			before: null,
			after: row,
			reason: row.approvedReason,
			now,
		}),
	]);
	return row;
}

export async function updatePricingPolicy(
	ctx: UserContext,
	input: z.infer<typeof publishDeliveryPricingInput>,
) {
	await requirePricingManager(ctx);
	const [draft] = await ctx.db
		.select()
		.from(policy)
		.where(and(market, eq(policy.id, input.draftId)))
		.limit(1);
	if (!draft) throw new NotFoundError();
	const latest = await head(ctx);
	if (
		draft.status !== "DRAFT" ||
		draft.previousVersion !== input.expectedVersion ||
		(latest?.version ?? EXPRESS_V1.version) !== input.expectedVersion
	)
		throw new ConflictError(
			"Las tarifas cambiaron. Actualiza y crea un nuevo borrador.",
		);
	const terms = deliveryPricingTermsSchema.parse(draft.terms);
	// Validate the executable formula as well as the wire schema before publishing.
	for (const [km, minutes] of [
		[2, 6],
		[4, 12],
		[8, 20],
		[12, 35],
	] as const)
		priceBreakdown({
			policyVersion: draft.version,
			terms,
			distanceMeters: km * 1000,
			durationSeconds: minutes * 60,
			merchantCoversDelivery: false,
		});
	const now = new Date();
	const activeFrom = new Date(
		Math.max(now.getTime(), draft.activeFrom.getTime()),
	);
	if (latest && activeFrom < latest.activeFrom)
		throw new ConflictError(
			"Hay una tarifa programada para una fecha posterior.",
		);
	const after = {
		...draft,
		status: "ACTIVE" as const,
		revision: (latest?.revision ?? 0) + 1,
		activeFrom,
		approvedReason: requireReason("pricing.publish", input.reason),
	};
	try {
		await ctx.db.batch([
			ctx.db
				.update(policy)
				.set({ status: "RETIRED" })
				.where(and(market, eq(policy.status, "ACTIVE"))),
			ctx.db
				.update(policy)
				.set({
					status: after.status,
					revision: after.revision,
					activeFrom,
					approvedReason: after.approvedReason,
				})
				.where(and(eq(policy.id, draft.id), eq(policy.status, "DRAFT"))),
			auditStatement(ctx, {
				id: `pricing-publish:${draft.id}`,
				action: "pricing.publish",
				targetType: "delivery_pricing_policy",
				targetId: draft.id,
				before: latest ?? {
					version: EXPRESS_V1.version,
					terms: DEFAULT_DELIVERY_PRICING_TERMS,
				},
				after,
				reason: after.approvedReason,
				now,
			}),
		]);
	} catch (error) {
		if (
			((await head(ctx))?.version ?? EXPRESS_V1.version) !==
			input.expectedVersion
		)
			throw new ConflictError(
				"Otra publicación se guardó primero. Actualiza las tarifas.",
			);
		throw error;
	}
	ctx.logger.info("delivery.pricing.published", {
		version: after.version,
		activeFrom: after.activeFrom,
		actorId: ctx.user.id,
	});
	return after;
}

import {
	auditLog,
	business,
	courierProfile,
	order,
	product,
	mobileConfigurationRevision as revision,
	mobileConfigurationState as state,
	upload,
	user,
} from "@pymeshub/db";
import {
	DEFAULT_MOBILE_CONFIGURATION,
	MOBILE_OPERATIONAL_ACTIONS,
	type MobileConfiguration,
	type MobileRole,
	mobileConfigurationSchema,
	mobileControlEnabled,
	newId,
} from "@pymeshub/shared";
import { and, desc, eq, inArray, like, lt, or, type SQL, sql } from "drizzle-orm";
import type { Context } from "../context";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../errors";
import { auditStatement } from "./audit";
import type { UserContext } from "./helpers";

const singleton = eq(state.id, "mobile");
const conflict = () =>
	new ConflictError("La configuración cambió. Actualiza antes de continuar.");

async function actor(ctx: UserContext, publishing = false) {
	const [row] = await ctx.db
		.select()
		.from(user)
		.where(eq(user.id, ctx.user.id))
		.limit(1);
	if (!row?.isAdmin || row.suspendedAt || (publishing && !row.canPublishMobile))
		throw new ForbiddenError(
			publishing
				? "Se requiere el permiso Super Admin: mobile.publish"
				: "Solo el equipo de PymesHub puede hacer esto",
		);
	return row;
}
async function current(ctx: Context) {
	const [row] = await ctx.db.select().from(state).where(singleton).limit(1);
	if (!row)
		throw new Error("Mobile configuration migration has not been applied");
	return row;
}
export async function published(ctx: Context) {
	const [row] = await ctx.db
		.select({
			id: revision.id,
			revision: revision.revision,
			createdAt: revision.createdAt,
			configuration: revision.configuration,
		})
		.from(state)
		.innerJoin(revision, eq(state.publishedRevisionId, revision.id))
		.where(singleton)
		.limit(1);
	return {
		revisionId: row?.id ?? null,
		revision: row?.revision ?? 0,
		publishedAt: row?.createdAt.toISOString() ?? null,
		configuration: mobileConfigurationSchema.parse(
			row?.configuration ?? DEFAULT_MOBILE_CONFIGURATION,
		),
	};
}
export async function readDraft(ctx: UserContext) {
	const admin = await actor(ctx);
	const [draft, live] = await Promise.all([current(ctx), published(ctx)]);
	return {
		version: draft.draftVersion,
		draft: draft.draft ? mobileConfigurationSchema.parse(draft.draft) : null,
		published: live,
		canPublish: admin.canPublishMobile,
	};
}

async function validateContent(
	ctx: Context,
	configuration: MobileConfiguration,
) {
	const images = [
		...new Set(
			configuration.content.flatMap((item) =>
				item.imagePath ? [item.imagePath.slice("/files/".length)] : [],
			),
		),
	];
	if (images.length) {
		const rows = await ctx.db
			.select({ id: upload.id })
			.from(upload)
			.where(
				and(inArray(upload.id, images), eq(upload.purpose, "mobile-content")),
			);
		if (rows.length !== images.length)
			throw new ValidationError("Usa imágenes subidas desde App móvil.");
	}
	for (const item of configuration.content) {
		const destination = item.destination;
		const role: MobileRole = destination.kind.startsWith("merchant")
			? "merchant"
			: destination.kind.startsWith("courier")
				? "courier"
				: "customer";
		if (
			!["home", "help", "settings", "inbox"].includes(destination.kind) &&
			item.roles.some((target) => target !== role)
		)
			throw new ValidationError(
				"El destino debe pertenecer al perfil que verá el aviso.",
			);
		if (destination.kind === "store") {
			const [found] = await ctx.db
				.select({ id: business.id })
				.from(business)
				.where(eq(business.slug, destination.value ?? ""))
				.limit(1);
			if (!found) throw new ValidationError("Elige un negocio existente.");
		} else if (destination.kind === "product") {
			const [found] = await ctx.db
				.select({ id: product.id })
				.from(product)
				.where(eq(product.id, destination.value ?? ""))
				.limit(1);
			if (!found) throw new ValidationError("Elige un producto existente.");
		}
	}
}

/** The audit insert only runs when the preceding CAS update succeeded in the same batch. */
function draftAudit(
	ctx: UserContext,
	version: number,
	draft: MobileConfiguration | null,
	now: Date,
	action: "mobile.draft" | "mobile.discard",
) {
	return ctx.db.insert(auditLog).select(
		ctx.db
			.select({
				id: sql<string>`${`mobile-draft:${version}`}`.as("id"),
				actorUserId: sql<string>`${ctx.user.id}`.as("actor_user_id"),
				action: sql<string>`${action}`.as("action"),
				targetType: sql<string>`'mobile_configuration'`.as("target_type"),
				targetId: sql<string>`'mobile'`.as("target_id"),
				meta: sql<
					Record<string, unknown>
				>`${JSON.stringify({ before: { version: version - 1 }, after: { version, draft }, reason: null })}`.as(
					"meta",
				),
				createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
			})
			.from(state)
			.where(
				and(
					singleton,
					eq(state.draftVersion, version),
					eq(state.updatedByUserId, ctx.user.id),
					eq(state.updatedAt, now),
					draft === null
						? sql`${state.draft} IS NULL`
						: sql`${state.draft} = ${JSON.stringify(draft)}`,
				),
			),
	);
}
async function changeDraft(
	ctx: UserContext,
	expectedVersion: number,
	draft: MobileConfiguration | null,
) {
	await actor(ctx);
	if (draft) await validateContent(ctx, draft);
	const now = new Date();
	try {
		const [result] = await ctx.db.batch([
			ctx.db
				.update(state)
				.set({
					draft,
					draftVersion: expectedVersion + 1,
					updatedByUserId: ctx.user.id,
					updatedAt: now,
				})
				.where(and(singleton, eq(state.draftVersion, expectedVersion)))
				.returning({ version: state.draftVersion }),
			draftAudit(
				ctx,
				expectedVersion + 1,
				draft,
				now,
				draft ? "mobile.draft" : "mobile.discard",
			),
		]);
		if (!result.length) throw conflict();
	} catch (error) {
		if ((await current(ctx)).draftVersion !== expectedVersion) throw conflict();
		throw error;
	}
	return readDraft(ctx);
}
export function saveDraft(
	ctx: UserContext,
	input: { expectedVersion: number; configuration: MobileConfiguration },
) {
	return changeDraft(ctx, input.expectedVersion, input.configuration);
}
export function discardDraft(
	ctx: UserContext,
	input: { expectedVersion: number },
) {
	return changeDraft(ctx, input.expectedVersion, null);
}
async function publishConfiguration(
	ctx: UserContext,
	input: { expectedVersion: number; reason: string },
	restoredFromId?: string,
) {
	await actor(ctx, true);
	const [draft, live] = await Promise.all([current(ctx), published(ctx)]);
	if (draft.draftVersion !== input.expectedVersion) throw conflict();
	let configuration = draft.draft;
	if (restoredFromId) {
		const [source] = await ctx.db
			.select()
			.from(revision)
			.where(eq(revision.id, restoredFromId))
			.limit(1);
		if (!source) throw new NotFoundError();
		configuration = source.configuration;
	}
	if (!configuration)
		throw new ValidationError("Guarda un borrador antes de publicar.");
	configuration = mobileConfigurationSchema.parse(configuration);
	await validateContent(ctx, configuration);
	const now = new Date();
	const id = newId("mobileConfigurationRevision");
	const next = {
		id,
		revision: live.revision + 1,
		previousRevisionId: live.revisionId,
		expectedDraftVersion: input.expectedVersion,
		configuration,
		publishedByUserId: ctx.user.id,
		reason: input.reason,
		restoredFromId: restoredFromId ?? null,
		createdAt: now,
	};
	try {
		await ctx.db.batch([
			ctx.db.insert(revision).values(next),
			ctx.db
				.update(state)
				.set({
					draft: null,
					draftVersion: input.expectedVersion + 1,
					publishedRevisionId: id,
					updatedByUserId: ctx.user.id,
					updatedAt: now,
				})
				.where(and(singleton, eq(state.draftVersion, input.expectedVersion))),
			auditStatement(ctx, {
				action: restoredFromId ? "mobile.restore" : "mobile.publish",
				targetType: "mobile_configuration",
				targetId: id,
				before: live,
				after: next,
				reason: input.reason,
				now,
			}),
		]);
	} catch (error) {
		if ((await current(ctx)).draftVersion !== input.expectedVersion)
			throw conflict();
		throw error;
	}
	return readDraft(ctx);
}
export function publishDraft(
	ctx: UserContext,
	input: { expectedVersion: number; reason: string },
) {
	return publishConfiguration(ctx, input);
}
export function restore(
	ctx: UserContext,
	input: { expectedVersion: number; reason: string; revisionId: string },
) {
	return publishConfiguration(ctx, input, input.revisionId);
}
export async function history(ctx: UserContext, input: { before?: number }) {
	await actor(ctx);
	const conditions: SQL[] = input.before
		? [lt(revision.revision, input.before)]
		: [];
	const rows = await ctx.db
		.select({
			id: revision.id,
			revision: revision.revision,
			previousRevisionId: revision.previousRevisionId,
			restoredFromId: revision.restoredFromId,
			reason: revision.reason,
			publishedByUserId: revision.publishedByUserId,
			createdAt: revision.createdAt,
		})
		.from(revision)
		.where(and(...conditions))
		.orderBy(desc(revision.revision))
		.limit(31);
	return {
		items: rows.slice(0, 30),
		next: rows.length > 30 ? rows[29]?.revision : undefined,
	};
}

/** Availability is scoped to mobile metadata; it never grants authorization or blocks completion. */
/** Read-only preview data; no fabricated users, orders, metrics or role escalation. */
export async function destinationOptions(ctx: UserContext, input: { kind: "store" | "product"; query: string; selectedValue?: string }) {
	await actor(ctx);
	if (input.kind === "store") return ctx.db.select({ value: business.slug, label: business.name }).from(business).where(and(eq(business.status, "ACTIVE"), or(like(business.name, `%${input.query}%`), input.selectedValue ? eq(business.slug, input.selectedValue) : undefined))).orderBy(sql`CASE WHEN ${business.slug} = ${input.selectedValue ?? ""} THEN 0 ELSE 1 END`, business.name).limit(30);
	return ctx.db.select({ value: product.id, label: product.name }).from(product).innerJoin(business, eq(product.businessId, business.id)).where(and(eq(product.status, "ACTIVE"), eq(business.status, "ACTIVE"), or(like(product.name, `%${input.query}%`), input.selectedValue ? eq(product.id, input.selectedValue) : undefined))).orderBy(sql`CASE WHEN ${product.id} = ${input.selectedValue ?? ""} THEN 0 ELSE 1 END`, product.name).limit(30);
}
export async function preview(ctx: UserContext, input: { role: MobileRole; businessId?: string; courierUserId?: string }) {
	await actor(ctx);
	const shops = await ctx.db.select({ id: business.id, slug: business.slug, name: business.name, status: business.status, currency: business.currency }).from(business)
		.where(input.role === "customer" ? eq(business.status, "ACTIVE") : undefined).limit(20);
	const couriers = await ctx.db.select({ userId: courierProfile.userId, displayName: courierProfile.displayName, serviceArea: courierProfile.serviceArea, isAvailable: courierProfile.isAvailable }).from(courierProfile).limit(20);
	const businessId = input.businessId ?? shops[0]?.id;
	const courierUserId = input.courierUserId ?? couriers[0]?.userId;
	const products = businessId ? await ctx.db.select({ id: product.id, businessId: product.businessId, name: product.name, imageUrl: product.imageUrl, priceMinor: product.priceMinor, currency: product.currency }).from(product)
		.where(and(eq(product.businessId, businessId), input.role === "customer" ? eq(product.status, "ACTIVE") : undefined)).limit(8) : [];
	const orderScope = input.role === "courier" ? (courierUserId ? eq(order.courierUserId, courierUserId) : undefined) : businessId ? eq(order.businessId, businessId) : undefined;
	const orders = orderScope ? await ctx.db.select({ id: order.id, reference: order.reference, businessId: order.businessId, status: order.status, totalMinor: order.totalMinor, currency: order.currency }).from(order).where(orderScope).orderBy(desc(order.createdAt)).limit(8) : [];
	return { shops, products, orders, couriers };
}

export async function requireMobileAction(
	ctx: Context,
	id: string | readonly string[],
) {
	if (ctx.client !== "android" && ctx.client !== "ios") return;
	const configuration = (await published(ctx)).configuration;
	const disabled = (typeof id === "string" ? [id] : id).find(
		(key) => !mobileControlEnabled(configuration, key),
	);
	if (disabled)
		throw new ConflictError(
			"Esta función está temporalmente desactivada en la app. Tus pedidos en curso siguen disponibles.",
			{ control: disabled },
		);
}
export function requireMobileProcedure(
	ctx: Context,
	procedure: keyof typeof MOBILE_OPERATIONAL_ACTIONS,
) {
	return requireMobileAction(ctx, MOBILE_OPERATIONAL_ACTIONS[procedure]);
}

import { type Db, deliveryQuote as quoteTable } from "@pymeshub/db";
import { type Currency, newId } from "@pymeshub/shared";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";

import { rateLimit } from "../context";
import type { Env } from "../env";
import { ConflictError, ValidationError } from "../errors";
import { EXPRESS_V1, routeFeeMinor } from "./delivery-pricing";
import type { UserContext } from "./helpers";
import { createOsrmRouting, type GeoPoint, type RouteResult } from "./routing";

const QUOTE_TTL_MS = 2 * 60 * 1000;
type QuoteRow = typeof quoteTable.$inferSelect;

/** Only CRC has a configured road tariff. Absence of the flag preserves legacy pricing. */
export function roadFeeEnabled(env: Env, currency: Currency): boolean {
	return env.ROUTE_FEE_ENABLED === "true" && currency === "CRC";
}

/** Bind a quote to the actual pinned coordinates, including edits to a saved address. */
export function routeInputKey(origin: GeoPoint, destination: GeoPoint): string {
	return [origin.lat, origin.lng, destination.lat, destination.lng]
		.map((value) => value.toFixed(6))
		.join(":");
}

export function cartPriceFingerprint(
	lines: readonly { id: string; quantity: number; unitPriceMinor: number }[],
): string {
	return JSON.stringify(
		lines
			.map((line) => [line.id, line.quantity, line.unitPriceMinor])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
	);
}

type RoadInputs = {
	userId: string;
	cartId: string;
	cartUpdatedAt: Date;
	cartFingerprint: string;
	locationId: string;
	addressId: string;
	consistentOrigin: GeoPoint;
	consistentDestination: GeoPoint;
	promotionCode: string | null;
	currency: Currency;
	subtotalMinor: number;
	discountMinor: number;
};

function sameCheckout(row: QuoteRow, input: RoadInputs): boolean {
	return (
		row.userId === input.userId &&
		row.cartId === input.cartId &&
		row.cartUpdatedAt.getTime() === input.cartUpdatedAt.getTime() &&
		row.cartFingerprint === input.cartFingerprint &&
		row.locationId === input.locationId &&
		row.addressId === input.addressId &&
		row.routeInputKey ===
			routeInputKey(input.consistentOrigin, input.consistentDestination) &&
		row.promotionCode === input.promotionCode &&
		row.pricingVersion === EXPRESS_V1.version &&
		row.currency === input.currency &&
		row.subtotalMinor === input.subtotalMinor &&
		row.discountMinor === input.discountMinor
	);
}

function payload(row: QuoteRow) {
	return {
		quoteId: row.id,
		expiresAt: row.expiresAt,
		distanceMeters: row.distanceMeters,
		durationSeconds: row.durationSeconds,
		baseFeeMinor: row.baseFeeMinor,
		geometry: row.geometry,
	};
}

/** Routes once per unexpired checkout state; a poll reuses the same locked amount. */
export async function createRoadQuote(
	ctx: UserContext,
	input: RoadInputs & { baseTotalMinor: number; freeDelivery: boolean },
) {
	const now = new Date();
	const previous = await ctx.db
		.select()
		.from(quoteTable)
		.where(
			and(
				eq(quoteTable.userId, input.userId),
				eq(quoteTable.cartId, input.cartId),
				eq(quoteTable.locationId, input.locationId),
				eq(quoteTable.addressId, input.addressId),
				gte(quoteTable.expiresAt, now),
			),
		)
		.orderBy(desc(quoteTable.createdAt))
		.limit(5);
	const cached = previous.find(
		(row) =>
			sameCheckout(row, input) &&
			row.feeMinor === (input.freeDelivery ? 0 : row.baseFeeMinor) &&
			row.totalMinor === input.baseTotalMinor + row.feeMinor,
	);
	if (cached)
		return {
			deliveryFeeMinor: cached.feeMinor,
			totalMinor: cached.totalMinor,
			roadQuote: payload(cached),
		};

	if (!ctx.env.ROUTING_BASE_URL)
		throw new ValidationError("checkout.refusal.deliveryQuoteUnavailable");
	await rateLimit(ctx.env, "cart:road-quote", ctx.user.id, 10, 60);
	let route: RouteResult;
	try {
		route = await createOsrmRouting({
			baseUrl: ctx.env.ROUTING_BASE_URL,
		}).route({
			origin: input.consistentOrigin,
			destination: input.consistentDestination,
			profile: "car",
		});
	} catch {
		throw new ValidationError("checkout.refusal.deliveryQuoteUnavailable");
	}
	const baseFeeMinor = routeFeeMinor(
		route.distanceMeters,
		route.durationSeconds,
	);
	const feeMinor = input.freeDelivery ? 0 : baseFeeMinor;
	const row: QuoteRow = {
		id: newId("deliveryQuote"),
		userId: input.userId,
		cartId: input.cartId,
		locationId: input.locationId,
		addressId: input.addressId,
		cartUpdatedAt: input.cartUpdatedAt,
		cartFingerprint: input.cartFingerprint,
		promotionCode: input.promotionCode,
		routeInputKey: routeInputKey(
			input.consistentOrigin,
			input.consistentDestination,
		),
		pricingVersion: EXPRESS_V1.version,
		currency: input.currency,
		subtotalMinor: input.subtotalMinor,
		discountMinor: input.discountMinor,
		baseFeeMinor,
		feeMinor,
		totalMinor: input.baseTotalMinor + feeMinor,
		distanceMeters: route.distanceMeters,
		durationSeconds: route.durationSeconds,
		geometry: route.geometry,
		expiresAt: new Date(now.getTime() + QUOTE_TTL_MS),
		createdAt: now,
	};
	await ctx.db.insert(quoteTable).values(row);
	return {
		deliveryFeeMinor: feeMinor,
		totalMinor: row.totalMinor,
		roadQuote: payload(row),
	};
}

/** Accept only the quote the customer saw, for the same cart and pinned stops. */
export async function roadQuoteForOrder(
	ctx: UserContext,
	quoteId: string | undefined,
	input: RoadInputs,
): Promise<QuoteRow> {
	if (!quoteId) throw new ConflictError("checkout.refusal.totalChanged");
	const [row] = await ctx.db
		.select()
		.from(quoteTable)
		.where(and(eq(quoteTable.id, quoteId), eq(quoteTable.userId, input.userId)))
		.limit(1);
	if (!row || row.expiresAt <= new Date() || !sameCheckout(row, input))
		throw new ConflictError("checkout.refusal.totalChanged");
	return row;
}

/** Bound the stored route geometry's lifetime without putting cleanup on checkout. */
export async function sweepExpiredRoadQuotes(
	db: Db,
	now = new Date(),
): Promise<number> {
	const expired = await db
		.select({ id: quoteTable.id })
		.from(quoteTable)
		.where(lt(quoteTable.expiresAt, new Date(now.getTime() - 60 * 60 * 1000)))
		.orderBy(quoteTable.expiresAt)
		.limit(100);
	if (expired.length === 0) return 0;
	await db.delete(quoteTable).where(
		inArray(
			quoteTable.id,
			expired.map((row) => row.id),
		),
	);
	return expired.length;
}

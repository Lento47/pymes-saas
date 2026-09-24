/**
 * The small pieces every other schema is built from. Centralised so that "what is a
 * valid price" is answered once — three clients each deciding that a price may be
 * negative is how a checkout total goes strange in a way nobody can reproduce.
 */

import { z } from "zod";
import { CURRENCIES } from "../money";

export const currencySchema = z.enum(CURRENCIES);

export const idSchema = z.string().min(5).max(64);
export const businessIdSchema = idSchema.startsWith("biz_");
export const productIdSchema = idSchema.startsWith("prd_");
export const orderIdSchema = idSchema.startsWith("ord_");

/**
 * Money, as an integer in the currency's minor unit. The ceiling is deliberately
 * generous but present: ₡100 000 000 is a plausible price for nothing in this
 * market, and a bound is what turns a fat-fingered input into an error message
 * instead of a product nobody can buy.
 */
export const moneyMinorSchema = z.number().int().min(0).max(100_000_000_000);
/** Signed, for option deltas — a smaller size is a negative delta. */
export const moneyDeltaSchema = z
	.number()
	.int()
	.min(-10_000_000)
	.max(10_000_000);
export const percentSchema = z.number().min(0).max(100);

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/**
 * Costa Rican phone numbers, plus a permissive fallback for the diaspora customer
 * who signs in with a +1. Normalised to digits with a leading country code so that
 * two customers typing the same number two ways are one contact.
 */
export const phoneSchema = z
	.string()
	.trim()
	.min(8)
	.max(24)
	.transform((value) => value.replace(/[^\d+]/g, ""))
	.refine((value) => /^\+?\d{8,15}$/.test(value), {
		message: "Número de teléfono inválido",
	});

export const slugSchema = z
	.string()
	.trim()
	.min(2)
	.max(80)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: "El identificador sólo puede tener minúsculas, números y guiones",
	});

/** Trimmed, length-bounded text. The bound is the point: an unbounded varchar is a denial of service with a nice name. */
export const shortText = (max: number) => z.string().trim().min(1).max(max);

export const imageUrlSchema = z
	.string()
	.trim()
	.max(500)
	.refine(
		(value) =>
			value.startsWith("/") || /^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(value),
		{ message: "La imagen debe ser una ruta interna o una URL https" },
	);

export const coordinatesSchema = z.object({
	lat: latitudeSchema,
	lng: longitudeSchema,
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/**
 * Sort keys a client may send, shared so that the API's allow-list and the client's
 * dropdown cannot drift into "the option exists in the UI but sorts by nothing".
 */
export const PRODUCT_SORTS = [
	"relevance",
	"price",
	"rating",
	"newest",
	"popular",
] as const;
export const BUSINESS_SORTS = [
	"distance",
	"rating",
	"popular",
	"newest",
] as const;
export const ORDER_SORTS = ["placedAt", "total"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export type BusinessSort = (typeof BUSINESS_SORTS)[number];

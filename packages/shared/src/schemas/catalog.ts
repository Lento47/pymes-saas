/**
 * Categories, products and their options — the discovery surface, and the shape the
 * product card in `design-EXAMPLE.md` is built against.
 *
 * The card and the detail page are one schema family rather than two: `ProductCard`
 * is what a list renders and `ProductDetail` is the card plus what only a detail
 * page has (the full option tree, stock, the gallery). A client can therefore render
 * a card from either, which is what makes "the list already has everything the
 * detail needs" true instead of aspirational.
 */

import { z } from "zod";
import { businessCardSchema, businessHoursSchema } from "./business";
import {
	currencySchema,
	imageUrlSchema,
	moneyDeltaSchema,
	moneyMinorSchema,
	shortText,
} from "./common";

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const categorySchema = z.object({
	id: z.string(),
	slug: z.string(),
	/**
	 * Spanish. `SUPPORTED_LOCALES` is `["es","en"]` and this is the locale the marketplace
	 * opens in, so it is the name a client draws unless it has been told to draw English.
	 */
	name: z.string(),
	/**
	 * The English name, or `null` where there is not one.
	 *
	 * A client showing `en` falls back to `name` rather than drawing an empty chip. The six
	 * demo categories `packages/db/src/seed.ts` writes are the rows that carry `null`: they
	 * are seeded in Spanish and the seed owns them.
	 */
	nameEn: z.string().nullable(),
	iconName: z.string().nullable(),
	imageUrl: z.string().nullable(),
	parentId: z.string().nullable(),
	sortOrder: z.number().int(),
	productCount: z.number().int().min(0).optional(),
});
export type Category = z.infer<typeof categorySchema>;

export const OPTION_KINDS = ["SINGLE", "MULTI"] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const productOptionInput = z.object({
	name: shortText(60),
	/** Signed: a smaller size is a negative delta, and a free option is zero. */
	priceDeltaMinor: moneyDeltaSchema.default(0),
	isDefault: z.boolean().default(false),
	isAvailable: z.boolean().default(true),
});
export type ProductOptionInput = z.infer<typeof productOptionInput>;

export const productOptionGroupInput = z
	.object({
		name: shortText(60),
		kind: z.enum(OPTION_KINDS).default("SINGLE"),
		isRequired: z.boolean().default(false),
		minSelect: z.number().int().min(0).max(10).default(0),
		maxSelect: z.number().int().min(1).max(10).default(1),
		sortOrder: z.number().int().min(0).max(999).default(0),
		options: z.array(productOptionInput).min(1).max(30),
	})
	.refine(
		(group) => group.kind === "SINGLE" || group.maxSelect >= group.minSelect,
		{
			message: "El máximo seleccionable debe ser mayor o igual al mínimo",
		},
	)
	.refine((group) => group.kind !== "SINGLE" || group.maxSelect === 1, {
		message: "Un grupo de selección única no puede permitir más de una opción",
	})
	.refine((group) => !group.isRequired || group.minSelect >= 1, {
		message: "Un grupo obligatorio debe exigir al menos una opción",
	});
export type ProductOptionGroupInput = z.infer<typeof productOptionGroupInput>;

/**
 * The fields, **without** the cross-field rule, so that the create and the update
 * schemas can share one definition.
 *
 * This split is not tidiness. zod 4 refuses `.partial()` on a schema that carries a
 * refinement — `"cannot be used on object schemas containing refinements"` — and it
 * refuses it *at module evaluation*, so the failure was not a rejected update but a
 * package that threw on `import` and took the whole API down at boot. The rule has to
 * live on each schema rather than on the shape they are built from.
 */
const productFields = z.object({
	name: shortText(150),
	description: z.string().trim().max(600).optional(),
	categoryId: z.string().optional(),
	imageUrl: imageUrlSchema.optional(),
	images: z.array(imageUrlSchema).max(8).default([]),
	priceMinor: moneyMinorSchema,
	compareAtPriceMinor: moneyMinorSchema.nullable().optional(),
	sku: z.string().trim().max(60).optional(),
	status: z.enum(PRODUCT_STATUSES).default("DRAFT"),
	isFeatured: z.boolean().default(false),
	trackInventory: z.boolean().default(false),
	stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
	prepTimeMinutes: z.number().int().min(0).max(600).optional(),
	tags: z.array(z.string().trim().max(30)).max(12).default([]),
	optionGroups: z.array(productOptionGroupInput).max(6).default([]),
});

/**
 * A "compare at" price that is not higher than the price is a UI bug wearing a data
 * costume: the card would render a struck-through number smaller than the live one,
 * which reads as a price increase to every customer who sees it.
 */
export const productCreateInput = productFields.refine(
	(product) =>
		product.compareAtPriceMinor == null ||
		product.compareAtPriceMinor > product.priceMinor,
	{
		message: "El precio anterior debe ser mayor que el precio actual",
		path: ["compareAtPriceMinor"],
	},
);
export type ProductCreateInput = z.infer<typeof productCreateInput>;

/**
 * Every field optional, and the rule re-applied by hand — `partial()` drops a
 * refinement along with the requirement, and an update that sets a compare-at price
 * below the price is exactly the edit the rule exists to refuse.
 *
 * The difference from `productCreateInput`'s copy: both prices are optional here, so
 * the rule can only fire when the update supplies both. Lowering a price without
 * touching `compareAtPriceMinor` must not be refused because the *stored*
 * compare-at is now too low — a partial update is validated against itself, and the
 * API compares the result to the stored row before writing.
 */
export const productUpdateInput = productFields
	.partial()
	.refine(
		(product) =>
			product.compareAtPriceMinor == null ||
			product.priceMinor == null ||
			product.compareAtPriceMinor > product.priceMinor,
		{
			message: "El precio anterior debe ser mayor que el precio actual",
			path: ["compareAtPriceMinor"],
		},
	);
export type ProductUpdateInput = z.infer<typeof productUpdateInput>;

/**
 * The sort field is `sortDirection`, and the name is load-bearing.
 *
 * `@trpc/tanstack-react-query` reserves two keys in an infinite query's input: it fills
 * `cursor` from the page param, and it writes **`direction`** itself — `"forward"` or
 * `"backward"` — overwriting whatever the caller passed. A feed input that spells its sort
 * direction `direction` therefore cannot be read through `infiniteQueryOptions` at all: the
 * transport replaces `"desc"` with `"forward"`, the enum rejects it, and the list returns a
 * validation error instead of rows. That was true of this input and of `orderListInput`, so
 * `/orders`, the shop's product list and the mobile store were all dead — see
 * `docs/api-surface.md`. `cursor` keeps its name on purpose: the reserved key is exactly the
 * field this input wants.
 *
 * `pageInput` in `pagination.ts` still says `direction`, because a page-numbered table is
 * read with `useQuery` and never meets the injected key.
 */
export const productListInput = z.object({
	businessId: z.string().optional(),
	categoryId: z.string().optional(),
	search: z.string().trim().max(120).optional(),
	/**
	 * Management only, and only for the shop the caller is on the team of: an
	 * owner listing their own catalogue asks for `["DRAFT", "ACTIVE"]` and gets
	 * both. Anybody else — no membership for the requested shop, or no shop
	 * requested at all — is answered as if this were absent, which is ACTIVE
	 * alone. A status filter a stranger could set would be a window into
	 * unpublished work, so the service enforces the membership rather than
	 * trusting the parameter.
	 */
	status: z.array(z.enum(PRODUCT_STATUSES)).max(3).optional(),
	minPriceMinor: moneyMinorSchema.optional(),
	maxPriceMinor: moneyMinorSchema.optional(),
	featuredOnly: z.boolean().default(false),
	sort: z
		.enum(["relevance", "price", "rating", "newest", "popular"])
		.default("relevance"),
	sortDirection: z.enum(["asc", "desc"]).default("desc"),
	cursor: z.string().max(200).optional(),
	limit: z.number().int().min(1).max(50).default(20),
});
export type ProductListInput = z.infer<typeof productListInput>;

export const productAvailabilitySchema = z.object({
	inStock: z.boolean(),
	quantity: z.number().int().min(0).nullable(),
	maxOrderQuantity: z.number().int().min(1),
});
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

/**
 * Whether this product can be bought right now. One function, used by the API to
 * decide and by the clients to render — a "sold out" badge computed separately in
 * three places is a badge that disagrees with the button next to it.
 */
export function availabilityOf(product: {
	trackInventory: boolean;
	stockQuantity: number;
	status: ProductStatus;
}): ProductAvailability {
	const inStock =
		product.status === "ACTIVE" &&
		(!product.trackInventory || product.stockQuantity > 0);
	return {
		inStock,
		quantity: product.trackInventory ? product.stockQuantity : null,
		maxOrderQuantity: product.trackInventory
			? Math.max(1, Math.min(20, product.stockQuantity))
			: 20,
	};
}

export const productBadgeSchema = z.object({
	type: z.enum(["new", "popular", "discount", "shipping", "custom"]),
	label: z.string(),
});
export type ProductBadge = z.infer<typeof productBadgeSchema>;

/** The seller strip inside a product card — deliberately not a full business card. */
export const sellerSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logoUrl: z.string().nullable(),
	rating: z.number().min(0).max(5).nullable(),
});
export type SellerSummary = z.infer<typeof sellerSummarySchema>;

export const productCardSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	imageUrl: z.string().nullable(),
	priceMinor: z.number().int(),
	compareAtPriceMinor: z.number().int().nullable(),
	/** Derived, never stored: a stored percentage is a second source of truth for a subtraction. */
	discountPercent: z.number().int().min(0).max(100).nullable(),
	currency: currencySchema,
	badges: z.array(productBadgeSchema),
	rating: z.number().min(0).max(5).nullable(),
	reviewCount: z.number().int().min(0),
	availability: productAvailabilitySchema,
	prepTimeMinutes: z.number().int().nullable(),
	seller: sellerSummarySchema,
});
export type ProductCard = z.infer<typeof productCardSchema>;

/**
 * The three shapes a promotion code takes, matching `promotion.kind` in the schema.
 *
 * Declared here as well as in `packages/db/src/schema.ts`, which is the same duplication
 * `BUSINESS_STATUSES`, `PRODUCT_STATUSES` and the rest already carry: the two are unions of
 * string literals, so a value produced by one assigns to the other without a cast, and the
 * database file says so in as many words. The reason it is a second declaration rather than
 * an import is the direction of the dependency — `@pymeshub/db` depends on `@pymeshub/shared`
 * and never the reverse, so a shared schema importing the column's union would invert it.
 */
export const PROMOTION_KINDS = ["PERCENT", "FIXED", "FREE_DELIVERY"] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

/**
 * A shop's offer, as a rail on a browse screen draws it.
 *
 * This is the **advertising** half of a promotion, and it is a different thing from the
 * cart's. `cart.ts`'s `promotionCode` and `promotionError` are the state of a code the
 * customer has already typed; this is a code they have not, on a card that exists to make
 * them want to. `applyPromotionInput` takes a code and nothing else because the server
 * resolves it — so a card can advertise a code without the client knowing what it is worth,
 * and without either client being able to compute a discount the API would not agree with.
 *
 * ## What is on it, and the two things that are not
 *
 * `value` is the code's own unit, which depends on `kind` — a whole percent for `PERCENT`,
 * minor units for `FIXED`, and ignored entirely for `FREE_DELIVERY`. That is the column's
 * documented shape (`packages/db/src/schema.ts`) and it is repeated here rather than
 * normalised into one unit, because normalising would mean the client multiplying by a
 * subtotal it does not have: "10% off" is a fact about the code, and "₡1 500 off" would be a
 * fact about a cart nobody has filled yet.
 *
 * `minOrderMinor`, `redemptions`, `startsAt` and `endsAt` are all columns on the row and none
 * of them is here. A browse card has no key to print a threshold in — `store.minOrder.short`
 * is the *shop's* minimum order and printing the code's threshold with those words would be
 * two different numbers under one sentence — and a deadline counts down, which is a clock
 * this card has no reason to own. The server filters on all four (`apps/api/src/services/
 * catalog.ts`), so what arrives here is already live and available; the cart re-reads them at
 * redemption and refuses with its own sentence if they no longer hold.
 *
 * The business is a `SellerSummary` and not a `BusinessCard`, which is the same decision
 * `productCardSchema.seller` makes and for the same reason: a card that carries a second
 * card's worth of chips is a card nobody can read four of in a row.
 */
export const promotionCardSchema = z.object({
	id: z.string(),
	/** The code the customer types at checkout. The whole point of advertising it. */
	code: z.string(),
	kind: z.enum(PROMOTION_KINDS),
	value: z.number().int().min(0),
	/**
	 * The shop's currency, and it is here rather than on `value` because `value` has no
	 * currency of its own — it is the shop's money. `docs/api-surface.md`'s rule is that
	 * money is minor units *always with its currency*, and a `FIXED` card that carried the
	 * integer without it would leave the client to guess which exponent to divide by, which
	 * is the one guess `formatMoney` exists to make unnecessary.
	 */
	currency: currencySchema,
	business: sellerSummarySchema,
});
export type PromotionCard = z.infer<typeof promotionCardSchema>;

export const productOptionSchema = z.object({
	id: z.string(),
	name: z.string(),
	priceDeltaMinor: z.number().int(),
	isDefault: z.boolean(),
	isAvailable: z.boolean(),
});
export type ProductOption = z.infer<typeof productOptionSchema>;

export const productOptionGroupSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(OPTION_KINDS),
	isRequired: z.boolean(),
	minSelect: z.number().int(),
	maxSelect: z.number().int(),
	sortOrder: z.number().int(),
	options: z.array(productOptionSchema),
});
export type ProductOptionGroup = z.infer<typeof productOptionGroupSchema>;

export const productDetailSchema = productCardSchema.extend({
	images: z.array(z.string()),
	categoryId: z.string().nullable(),
	categoryName: z.string().nullable(),
	/**
	 * The category's English name, flattened onto the detail row beside the Spanish one.
	 *
	 * `null` where the row has none — the six demo categories `packages/db/src/seed.ts`
	 * writes carry Spanish only — so a client showing `en` falls back to `categoryName`,
	 * which is never null when a category is set at all.
	 */
	categoryNameEn: z.string().nullable(),
	sku: z.string().nullable(),
	status: z.enum(PRODUCT_STATUSES),
	isFeatured: z.boolean(),
	tags: z.array(z.string()),
	soldCount: z.number().int().min(0),
	optionGroups: z.array(productOptionGroupSchema),
	/** Rendered as "more from this business" — a list of cards, so a list can show them. */
	related: z.array(productCardSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const productSearchResultSchema = z.object({
	products: z.array(productCardSchema),
	businesses: z.array(businessCardSchema),
	categories: z.array(categorySchema),
});
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;

/**
 * A business's public page, in one response.
 *
 * Four reads behind one procedure because a phone opening a storefront needs all
 * four at once, and four round trips is four spinners on a connection that is one
 * bar of signal. The pieces stay separate inside the shape so a screen can render
 * the header before the grid without a second request for either.
 *
 * `isOpen` sits beside the card rather than inside it: the card's own copy answers
 * "open, and how far", and this one is the flag the storefront's header switches on.
 * Both come from the same read — neither is computed by a client, which would need
 * the business's timezone and its hours to work out a question the server already
 * answered.
 *
 * It lives in this file rather than in `business.ts` because it carries product and
 * category cards, and `business.ts` is imported *by* them: a schema here that named
 * a storefront would make the two modules import each other at evaluation time,
 * which for a zod schema at module scope is `undefined` rather than a cycle the
 * runtime can resolve.
 */
export const businessStorefrontSchema = z.object({
	card: businessCardSchema,
	hours: businessHoursSchema,
	isOpen: z.boolean(),
	categories: z.array(categorySchema),
	featured: z.array(productCardSchema),
});
export type BusinessStorefront = z.infer<typeof businessStorefrontSchema>;

/** Compute the derived discount. Kept next to the field it derives so they cannot drift. */
export function discountPercentOf(
	priceMinor: number,
	compareAtPriceMinor: number | null | undefined,
): number | null {
	if (!compareAtPriceMinor || compareAtPriceMinor <= priceMinor) return null;
	return Math.round(
		((compareAtPriceMinor - priceMinor) / compareAtPriceMinor) * 100,
	);
}

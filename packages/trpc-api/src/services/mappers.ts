/**
 * Rows in, wire shapes out.
 *
 * Every procedure in this API answers with a shape from `@pymeshub/shared`, and a
 * row is never that shape: it carries columns the customer must not see, it has
 * nulls where the schema has a value, and several fields the schema declares are
 * *derived* rather than stored. Putting that translation in one module rather than
 * in eight services is what makes it possible to answer "what does a product card
 * contain" without reading the whole router tree — and it is what keeps a leak
 * (an `email` on a card, a `costMinor` on a line) a one-file change to review.
 *
 * Two rules hold throughout:
 *
 * - **A derived field is derived, never defaulted to something plausible.** A
 *   product with no reviews has `rating: null`, not `rating: 0`; a business with no
 *   prep time recorded borrows the platform default *and* the default is one named
 *   constant, so the card and the create form cannot disagree.
 * - **Nothing here reads a table.** A mapper takes rows and returns shapes; a
 *   function that queries is a service. That is why `distanceKm` is a parameter:
 *   the caller has the customer's coordinates and the business's, and the mapper
 *   only does the arithmetic.
 */

import type {
	Address as AddressRow,
	AuditLog as AuditLogRow,
	Business as BusinessRow,
	CartItem as CartItemRow,
	Category as CategoryRow,
	ChosenOption,
	Membership as MembershipRow,
	Notification as NotificationRow,
	OrderEvent as OrderEventRow,
	OrderItem as OrderItemRow,
	Order as OrderRow,
	Payout as PayoutRow,
	ProductOptionGroup as ProductOptionGroupRow,
	ProductOption as ProductOptionRow,
	Product as ProductRow,
	Promotion as PromotionRow,
	Review as ReviewRow,
	User as UserRow,
} from "@pymeshub/db";

import {
	type Address,
	type AdminAction,
	type AdminBusinessRow,
	type AdminOrderRow,
	type AdminUserRow,
	type AuditLogEntry,
	availabilityOf,
	type BusinessCard,
	type BusinessHoursEntry,
	type BusinessSettings,
	type Category,
	type Currency,
	canTransition,
	customerTimeline,
	discountPercentOf,
	type MembershipSummary,
	type Notification,
	nextStatuses as nextStatusesFrom,
	type OrderActor,
	type OrderDetail,
	type OrderEvent,
	type OrderItem as OrderItemShape,
	type OrderSummary,
	type OrderTracking,
	type ProductAvailability,
	type Payout,
	type ProductCard,
	type ProductDetail,
	type ProductOptionGroup,
	type PromotionCard,
	type Review,
	type SellerSummary,
	type StaffMember,
	type UserProfile,
} from "@pymeshub/shared";

import { isOpenAt } from "./helpers";

/**
 * What a card says when the business has not filled the field in.
 *
 * Named rather than inlined so the storefront, the product card and the seed all
 * quote the same number — the alternative is a card that says 25 minutes and a
 * checkout that says 30, which reads as a bug in the app rather than as missing
 * data. It matches `businessCreateInput`'s default.
 */
export const DEFAULT_PREP_MINUTES = 25;

/** `businessCreateInput`'s default radius, for the same reason. */
export const DEFAULT_DELIVERY_RADIUS_KM = 6;

/** A business with no currency recorded cannot exist; this is the fallback of last resort. */
const FALLBACK_CURRENCY: Currency = "CRC";

/** A product younger than this wears the "Nuevo" badge. */
const NEW_PRODUCT_DAYS = 14;

/** Units sold before a product is "Popular". Deliberately low: this market's shops are small. */
const POPULAR_SOLD_COUNT = 20;

const DAY_MS = 86_400_000;

type ProductMapperRow = ProductRow & {
	locationScope?: ProductCard["locationScope"];
	availability?: Partial<ProductAvailability>;
};

function productAvailabilityOf(row: ProductMapperRow): ProductAvailability {
	const nested = row.availability;
	const legacy = availabilityOf({
		trackInventory: row.trackInventory,
		stockQuantity: row.stockQuantity,
		status: row.status,
	});

	if (!nested) return legacy;

	return {
		inStock: nested.inStock ?? legacy.inStock,
		quantity: nested.quantity === undefined ? legacy.quantity : nested.quantity,
		maxOrderQuantity: nested.maxOrderQuantity ?? legacy.maxOrderQuantity,
		enabled: nested.enabled ?? legacy.enabled,
		...(nested.schedule ? { schedule: nested.schedule } : {}),
		unavailableReason:
			nested.unavailableReason === undefined
				? legacy.unavailableReason
				: nested.unavailableReason,
		...("inventory" in nested && nested.inventory
			? { inventory: nested.inventory }
			: {}),
	};
}

export function currencyOf(value: string): Currency {
	return value as Currency;
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export function sellerSummaryOf(row: BusinessRow): SellerSummary {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		logoUrl: row.logoUrl,
		// A business nobody has rated has no rating, rather than a rating of zero. The
		// difference matters on a card: "0.0 ★" reads as terrible, "Sin reseñas" reads
		// as new.
		rating: row.ratingCount > 0 ? row.ratingAvg : null,
	};
}

export function businessCardOf(
	row: BusinessRow,
	options: {
		categoryName?: string | null;
		/** The English name, absent on the rows the seed wrote — see `categorySchema.nameEn`. */
		categoryNameEn?: string | null;
		/** Null when the customer sent no coordinates, or the business has none. */
		distanceKm?: number | null;
		now?: Date;
	} = {},
): BusinessCard {
	const now = options.now ?? new Date();

	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		logoUrl: row.logoUrl,
		coverUrl: row.coverUrl,
		// A card's `city` is not nullable, and a draft business may not have one yet.
		// An empty string renders as nothing rather than as "null" on a card.
		city: row.city ?? "",
		categoryId: row.categoryId,
		categoryName: options.categoryName ?? null,
		categoryNameEn: options.categoryNameEn ?? null,
		currency: currencyOf(row.currency),
		ratingAvg: row.ratingAvg,
		ratingCount: row.ratingCount,
		deliveryEnabled: row.deliveryEnabled,
		pickupEnabled: row.pickupEnabled,
		deliveryFeeMinor: row.deliveryFeeMinor,
		prepTimeMinutes: row.prepTimeMinutes ?? DEFAULT_PREP_MINUTES,
		minOrderMinor: row.minOrderMinor,
		isVerified: row.isVerified,
		isOpen: isOpenAt(row.hours, now),
		distanceKm: options.distanceKm ?? null,
	};
}

export function businessSettingsOf(
	row: BusinessRow,
	options: {
		categoryName?: string | null;
		categoryNameEn?: string | null;
		now?: Date;
	} = {},
): BusinessSettings {
	return {
		...businessCardOf(row, options),
		status: row.status,
		phone: row.phone,
		email: row.email,
		line1: row.line1 ?? "",
		line2: row.line2,
		region: row.region ?? "",
		country: row.country ?? "CR",
		postalCode: row.postalCode,
		lat: row.lat,
		lng: row.lng,
		deliveryRadiusKm: row.deliveryRadiusKm ?? DEFAULT_DELIVERY_RADIUS_KM,
		// Hours are stored as JSON and never as a partial set, so "no hours" is an
		// empty list, not a missing field.
		hours: (row.hours ?? []) as BusinessHoursEntry[],
		createdAt: row.createdAt,
	};
}

export function membershipSummaryOf(row: {
	businessId: string;
	businessName: string;
	businessSlug: string;
	logoUrl: string | null;
	role: MembershipSummary["role"];
}): MembershipSummary {
	return {
		businessId: row.businessId,
		businessName: row.businessName,
		businessSlug: row.businessSlug,
		logoUrl: row.logoUrl,
		role: row.role,
	};
}

export function staffMemberOf(
	membershipRow: MembershipRow,
	userRow: Pick<UserRow, "id" | "name" | "email" | "image">,
): StaffMember {
	return {
		userId: userRow.id,
		name: userRow.name,
		email: userRow.email,
		image: userRow.image,
		role: membershipRow.role,
		joinedAt: membershipRow.createdAt,
	};
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export function categoryOf(row: CategoryRow, productCount?: number): Category {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		nameEn: row.nameEn,
		iconName: row.iconName,
		imageUrl: row.imageUrl,
		parentId: row.parentId,
		sortOrder: row.sortOrder,
		...(productCount === undefined ? {} : { productCount }),
	};
}

/**
 * The badges a card shows, each one derived from a column rather than stored.
 *
 * A stored badge is a second source of truth for a fact the row already carries —
 * and the failure is not cosmetic: a "Rebajado" badge left behind after the
 * compare-at price is cleared is a card advertising a discount that does not exist.
 */
function badgesOf(
	row: ProductRow,
	business: BusinessRow,
	now: Date,
): ProductCard["badges"] {
	const badges: ProductCard["badges"] = [];

	const discountPercent = discountPercentOf(
		row.priceMinor,
		row.compareAtPriceMinor,
	);
	if (discountPercent !== null && discountPercent > 0) {
		badges.push({ type: "discount", label: `-${discountPercent}%` });
	}

	if (now.getTime() - row.createdAt.getTime() < NEW_PRODUCT_DAYS * DAY_MS) {
		badges.push({ type: "new", label: "Nuevo" });
	}

	if (row.soldCount >= POPULAR_SOLD_COUNT) {
		badges.push({ type: "popular", label: "Popular" });
	}

	if (business.deliveryEnabled) {
		badges.push({ type: "shipping", label: "Domicilio" });
	}

	return badges;
}

export function productCardOf(
	row: ProductMapperRow,
	business: BusinessRow,
	options: { now?: Date } = {},
): ProductCard {
	const now = options.now ?? new Date();

	return {
		id: row.id,
		title: row.name,
		description: row.description,
		imageUrl: row.imageUrl,
		priceMinor: row.priceMinor,
		compareAtPriceMinor: row.compareAtPriceMinor,
		discountPercent: discountPercentOf(row.priceMinor, row.compareAtPriceMinor),
		currency: currencyOf(row.currency),
		badges: badgesOf(row, business, now),
		rating: row.ratingCount > 0 ? row.ratingAvg : null,
		reviewCount: row.ratingCount,
		availability: productAvailabilityOf(row),
		locationScope: row.locationScope ?? "all_locations",
		prepTimeMinutes: row.prepTimeMinutes,
		seller: sellerSummaryOf(business),
	};
}

/**
 * A promotion row and the shop running it, as the rail on a browse screen draws it.
 *
 * The shop arrives as a `SellerSummary` — `sellerSummaryOf`, the same function a product
 * card's strip uses — rather than as a `BusinessCard`, and this is the decision that makes
 * `promotionCardSchema` cheap to have: the whole of what the second card would add is a
 * cover image, a distance and a rating the rail cannot rank by anyway.
 *
 * `value` and `kind` are copied across untouched. There is no unit conversion here on
 * purpose: a `PERCENT` code's worth and a `FIXED` code's worth are not comparable, and a
 * mapper that normalised them would have to invent a subtotal to normalise against. The
 * client renders whichever sentence its `kind` names, and the words for the three live in
 * `@pymeshub/i18n` beside the cart's own promotion copy.
 */
export function promotionCardOf(
	row: PromotionRow,
	business: BusinessRow,
): PromotionCard {
	return {
		id: row.id,
		code: row.code,
		kind: row.kind,
		value: row.value,
		// The shop's currency and not a column on `promotion`: `value` is money the shop is
		// giving away, in the shop's own unit, and the row has no currency of its own to
		// disagree with.
		currency: currencyOf(business.currency),
		business: sellerSummaryOf(business),
	};
}

export function productOptionGroupOf(
	group: ProductOptionGroupRow,
	options: ProductOptionRow[],
): ProductOptionGroup {
	return {
		id: group.id,
		name: group.name,
		kind: group.kind,
		isRequired: group.isRequired,
		minSelect: group.minSelect,
		maxSelect: group.maxSelect,
		sortOrder: group.sortOrder,
		options: options
			.slice()
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map((option) => ({
				id: option.id,
				name: option.name,
				priceDeltaMinor: option.priceDeltaMinor,
				isDefault: option.isDefault,
				isAvailable: option.isAvailable,
			})),
	};
}

export function productDetailOf(input: {
	product: ProductRow;
	business: BusinessRow;
	categoryName: string | null;
	categoryNameEn: string | null;
	optionGroups: ProductOptionGroup[];
	related: ProductCard[];
}): ProductDetail {
	return {
		...productCardOf(input.product, input.business),
		images: (input.product.images ?? []) as string[],
		categoryId: input.product.categoryId,
		categoryName: input.categoryName,
		categoryNameEn: input.categoryNameEn,
		sku: input.product.sku,
		status: input.product.status,
		isFeatured: input.product.isFeatured,
		tags: (input.product.tags ?? []) as string[],
		soldCount: input.product.soldCount,
		optionGroups: input.optionGroups,
		related: input.related,
	};
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

/**
 * A cart line, with its price arithmetic done under it.
 *
 * `effectiveUnitPriceMinor` is the product's price plus every chosen option's delta,
 * and `lineTotalMinor` is that times the quantity — computed here rather than in the
 * client because the cart total and the order total are the same numbers, and two
 * implementations of "sum the lines" is how a checkout shows ₡150 less than the
 * receipt.
 *
 * The chosen options are read from the *line*, not from the product's current option
 * rows: an option renamed or repriced since the customer chose it must not silently
 * change what they have in front of them.
 */
export function cartItemOf(input: {
	item: CartItemRow;
	product: Pick<
		ProductRow,
		"id" | "name" | "imageUrl" | "status" | "trackInventory" | "stockQuantity"
	>;
}): {
	id: string;
	productId: string;
	name: string;
	imageUrl: string | null;
	quantity: number;
	unitPriceMinor: number;
	effectiveUnitPriceMinor: number;
	lineTotalMinor: number;
	options: { id: string; name: string; priceDeltaMinor: number }[];
	notes: string | null;
	unavailableReason: string | null;
} {
	const chosen = (input.item.options ?? []) as ChosenOption[];
	const delta = chosen.reduce(
		(total, option) => total + option.priceDeltaMinor,
		0,
	);
	const effectiveUnitPrice = input.item.unitPriceMinor + delta;

	const availability = availabilityOf({
		trackInventory: input.product.trackInventory,
		stockQuantity: input.product.stockQuantity,
		status: input.product.status,
	});

	return {
		id: input.item.id,
		productId: input.item.productId,
		name: input.product.name,
		imageUrl: input.product.imageUrl,
		quantity: input.item.quantity,
		unitPriceMinor: input.item.unitPriceMinor,
		effectiveUnitPriceMinor: effectiveUnitPrice,
		lineTotalMinor: effectiveUnitPrice * input.item.quantity,
		options: chosen.map((option) => ({
			id: option.optionId,
			name: option.name,
			priceDeltaMinor: option.priceDeltaMinor,
		})),
		notes: input.item.notes,
		// A line the customer cannot check out, explained rather than silently dropped:
		// a cart that loses a line without saying so is a customer who thinks they
		// ordered it.
		unavailableReason: availability.inStock
			? null
			: "Este producto ya no está disponible",
	};
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** "2× Café chorreado y 1 más" — the one line a list renders. */
function headlineOf(
	items: Pick<OrderItemRow, "nameSnapshot" | "quantity">[],
): string {
	const first = items[0];
	if (!first) return "Pedido";
	const others = items.length - 1;
	return others > 0
		? `${first.quantity}× ${first.nameSnapshot} y ${others} más`
		: `${first.quantity}× ${first.nameSnapshot}`;
}

/**
 * When the order is expected ready: the prep time counted from the moment the
 * business agreed to it, not from the moment the customer tapped.
 *
 * Null once the order is finished. An estimate that survives completion is a screen
 * promising a time that has already passed.
 */
function estimatedReadyAtOf(
	order: OrderRow,
	prepTimeMinutes: number | null,
): Date | null {
	if (
		order.status === "COMPLETED" ||
		order.status === "CANCELLED" ||
		order.status === "REJECTED"
	) {
		return null;
	}
	const anchor = order.acceptedAt ?? order.placedAt;
	return new Date(
		anchor.getTime() + (prepTimeMinutes ?? DEFAULT_PREP_MINUTES) * 60_000,
	);
}

export function orderSummaryOf(input: {
	order: OrderRow;
	items: Pick<OrderItemRow, "nameSnapshot" | "quantity">[];
	/** Whose side of the order is asking — the state machine answers differently. */
	actor: OrderActor;
	prepTimeMinutes: number | null;
}): OrderSummary {
	const { order } = input;
	const itemCount = input.items.reduce(
		(total, item) => total + item.quantity,
		0,
	);

	return {
		id: order.id,
		locationId: order.locationId,
		reference: order.reference,
		status: order.status,
		fulfilment: order.fulfilment,
		paymentMethod: order.paymentMethod,
		paymentStatus: order.paymentStatus,
		totalMinor: order.totalMinor,
		currency: currencyOf(order.currency),
		// The schema floors this at 1: an order with no lines cannot exist, and a
		// summary that says "0 artículos" is one a list renders as broken.
		itemCount: Math.max(1, itemCount),
		headline: headlineOf(input.items),
		placedAt: order.placedAt,
		// Computed from the shared state machine rather than from a per-screen list, so
		// the button a business sees and the transition the API will accept are the
		// same fact.
		nextStatuses: nextStatusesFrom(order.status, input.actor, order.fulfilment),
		canCancel: canTransition({
			from: order.status,
			to: "CANCELLED",
			actor: input.actor,
			fulfilment: order.fulfilment,
		}),
		estimatedReadyAt: estimatedReadyAtOf(order, input.prepTimeMinutes),
	};
}

export function orderItemOf(row: OrderItemRow): OrderItemShape {
	const chosen = (row.options ?? []) as ChosenOption[];
	return {
		id: row.id,
		// Nullable in the shape though not in the database: a product row is never
		// deleted, but a line whose snapshot outlived its product must still render.
		productId: row.productId,
		name: row.nameSnapshot,
		// The picture as it was when the line was bought, and not the product's today -
		// see `orderItemSchema.imageUrl`. `null` when the product had no picture then.
		imageUrl: row.imageUrlSnapshot,
		unitPriceMinor: row.unitPriceMinor,
		quantity: row.quantity,
		lineTotalMinor: row.lineTotalMinor,
		options: chosen.map((option) => ({
			name: option.name,
			priceDeltaMinor: option.priceDeltaMinor,
		})),
		notes: row.notes,
	};
}

export function orderEventOf(
	row: OrderEventRow,
	actorName: string | null,
): OrderEvent {
	return {
		id: row.id,
		status: row.toStatus,
		actor: row.actor,
		actorName,
		note: row.note,
		createdAt: row.createdAt,
	};
}

/** The delivery address on an order, which is the customer's address, not the caller's. */
export function orderDeliveryAddressOf(
	row: AddressRow,
): OrderDetail["deliveryAddress"] {
	return {
		label: row.label ?? "Casa",
		line1: row.line1,
		line2: row.line2,
		city: row.city,
		region: row.region ?? "",
		postalCode: row.postalCode,
		lat: row.lat,
		lng: row.lng,
		phone: row.phone,
		instructions: row.instructions,
	};
}

export function orderDetailOf(input: {
	order: OrderRow;
	items: OrderItemRow[];
	business: Pick<
		BusinessRow,
		"id" | "name" | "slug" | "logoUrl" | "phone" | "prepTimeMinutes"
	>;
	customer: { id: string; name: string; phone: string | null };
	deliveryAddress: AddressRow | null;
	events: { row: OrderEventRow; actorName: string | null }[];
	review: ReviewRow | null;
	actor: OrderActor;
}): OrderDetail {
	const { order } = input;

	return {
		...orderSummaryOf({
			order,
			items: input.items,
			actor: input.actor,
			prepTimeMinutes: input.business.prepTimeMinutes,
		}),
		business: {
			id: input.business.id,
			name: input.business.name,
			slug: input.business.slug,
			logoUrl: input.business.logoUrl,
			phone: input.business.phone,
		},
		customer: input.customer,
		items: input.items.map(orderItemOf),
		totals: {
			subtotalMinor: order.subtotalMinor,
			discountMinor: order.discountMinor,
			deliveryFeeMinor: order.deliveryFeeMinor,
			taxMinor: order.taxMinor,
			tipMinor: order.tipMinor,
			totalMinor: order.totalMinor,
			currency: currencyOf(order.currency),
		},
		deliveryAddress: input.deliveryAddress
			? orderDeliveryAddressOf(input.deliveryAddress)
			: null,
		// The reference is what a customer reads at the counter, so it is the pickup
		// code: two codes for one order would be two things to get wrong. A delivery
		// has none — nobody collects anything.
		pickupCode: order.fulfilment === "PICKUP" ? order.reference : null,
		courier:
			order.courierName || order.courierPhone
				? { name: order.courierName, phone: order.courierPhone }
				: null,
		customerNotes: order.notes,
		events: input.events.map((event) =>
			orderEventOf(event.row, event.actorName),
		),
		review: input.review
			? {
					id: input.review.id,
					rating: input.review.rating,
					comment: input.review.comment,
				}
			: null,
		cancellationReason: order.cancelReason,
		scheduledFor: order.scheduledFor,
		completedAt: order.completedAt,
	};
}

export function orderTrackingOf(
	order: OrderRow,
	events: OrderEventRow[],
	prepTimeMinutes: number | null,
): OrderTracking {
	// The step's timestamp comes from the event that reached it, so the tracker shows
	// when each step actually happened rather than inferring it from the next one.
	const reachedAt = new Map<string, Date>();
	for (const event of events) {
		if (!reachedAt.has(event.toStatus))
			reachedAt.set(event.toStatus, event.createdAt);
	}

	return {
		orderId: order.id,
		status: order.status,
		timeline: customerTimeline(order.status, order.fulfilment).map((step) => ({
			status: step.status,
			state: step.state,
			at: reachedAt.get(step.status) ?? null,
		})),
		courier:
			order.courierName || order.courierPhone
				? {
						name: order.courierName,
						phone: order.courierPhone,
						// The latest foreground ping from the assigned courier's
						// phone, or nulls when no ping has landed yet. Readers
						// treat a `updatedAt` older than a minute as "last seen",
						// never as live — the app posts while the run is open
						// and goes quiet in the background.
						lat: order.courierLat,
						lng: order.courierLng,
						updatedAt: order.courierAt,
					}
				: null,
		estimatedReadyAt: estimatedReadyAtOf(order, prepTimeMinutes),
		// No delivery-leg estimate is offered: the only honest inputs would be a courier
		// position and a routing service, and neither exists yet. A number here would be
		// a promise the product cannot keep.
		estimatedDeliveryAt: null,
	};
}

// ---------------------------------------------------------------------------
// Reviews, notifications, payouts, audit
// ---------------------------------------------------------------------------

export function reviewOf(
	row: ReviewRow,
	author: { name: string; image: string | null },
	reply: { text: string; at: Date } | null,
): Review {
	return {
		id: row.id,
		orderId: row.orderId,
		businessId: row.businessId,
		rating: row.rating,
		comment: row.comment,
		// The review table has no image column, so the accepted-but-unstored URLs are
		// reported as an empty list rather than echoed back as though they had been
		// kept. Echoing them would make a client believe a re-read would return them.
		imageUrls: [],
		authorName: author.name,
		authorImage: author.image,
		reply: reply?.text ?? null,
		repliedAt: reply?.at ?? null,
		createdAt: row.createdAt,
	};
}

export function notificationOf(row: NotificationRow): Notification {
	return {
		id: row.id,
		kind: row.kind,
		title: row.title,
		body: row.body,
		data: row.data ?? null,
		readAt: row.readAt,
		createdAt: row.createdAt,
	};
}

export function payoutOf(
	row: PayoutRow,
	options: {
		businessName: string;
		currency: Currency;
		orderCount: number;
		/** Read back from the audit entry that marked it paid; absent until then. */
		reference?: string | null;
	},
): Payout {
	return {
		id: row.id,
		businessId: row.businessId,
		businessName: options.businessName,
		currency: options.currency,
		// What the business is actually owed: gross less the platform's fee. The payout
		// table stores all three, and the one that moves is the net — a client that
		// added up gross would show an owner money the platform keeps.
		amountMinor: row.netMinor,
		orderCount: options.orderCount,
		periodStart: row.periodStart,
		periodEnd: row.periodEnd,
		status: row.status,
		paidAt: row.paidAt,
		// No column holds either, so neither is invented; the reference is recovered
		// from the audit entry when one exists.
		method: null,
		reference: options.reference ?? null,
	};
}

export function userProfileOf(row: UserRow): UserProfile {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		image: row.image,
		phone: row.phone,
		isAdmin: row.isAdmin,
		createdAt: row.createdAt,
	};
}

export function addressOf(row: AddressRow): Address {
	return {
		id: row.id,
		label: row.label ?? "Casa",
		line1: row.line1,
		// The shared `addressInput` declares its optional fields as `T | undefined`
		// rather than as nullable, because they are form fields. A nullable column read
		// straight into them is a type error, and `?? undefined` is the conversion the
		// two representations need — not a cast, because a cast here would hide a
		// genuinely missing field behind the same silence.
		line2: row.line2 ?? undefined,
		city: row.city,
		region: row.region ?? "",
		country: row.country,
		postalCode: row.postalCode ?? undefined,
		lat: row.lat ?? undefined,
		lng: row.lng ?? undefined,
		phone: row.phone ?? undefined,
		instructions: row.instructions ?? undefined,
		isDefault: row.isDefault,
		// The address table has no created timestamp — it predates the decision, and a
		// column added for one field would be a migration for cosmetics. The epoch is
		// the honest sentinel; a client that renders it as a date is already showing a
		// date the product never offered.
		createdAt: new Date(0),
	};
}

export function auditLogEntryOf(
	row: AuditLogRow,
	actorName: string | null,
): AuditLogEntry {
	const meta = (row.meta ?? {}) as {
		before?: unknown;
		after?: unknown;
		reason?: string;
	};

	return {
		id: row.id,
		actorId: row.actorUserId ?? "",
		actorName,
		// Every row in this table was written by `services/admin.ts` with an action from
		// `ADMIN_ACTIONS`, so anything else is our bug and belongs in the log with the
		// request id, not silently rendered as an unknown action.
		action: row.action as AdminAction,
		targetType: row.targetType,
		targetId: row.targetId,
		before: meta.before ?? null,
		after: meta.after ?? null,
		reason: meta.reason ?? null,
		createdAt: row.createdAt,
	};
}

export function adminBusinessRowOf(input: {
	business: BusinessRow;
	ownerName: string | null;
	ownerEmail: string | null;
	productCount: number;
	orderCount: number;
	grossVolumeMinor: number;
	suspendedReason: string | null;
}): AdminBusinessRow {
	return {
		id: input.business.id,
		name: input.business.name,
		slug: input.business.slug,
		city: input.business.city ?? "",
		status: input.business.status,
		isVerified: input.business.isVerified,
		currency: currencyOf(input.business.currency),
		ownerName: input.ownerName,
		ownerEmail: input.ownerEmail,
		productCount: input.productCount,
		orderCount: input.orderCount,
		// In the business's own currency. Never added to another business's: see
		// `admin.metrics`'s `volumeByCurrency`.
		grossVolumeMinor: input.grossVolumeMinor,
		createdAt: input.business.createdAt,
		suspendedReason: input.suspendedReason,
	};
}

export function adminUserRowOf(input: {
	user: UserRow;
	businessRoles: AdminUserRow["businessRoles"];
	orderCount: number;
}): AdminUserRow {
	return {
		id: input.user.id,
		name: input.user.name,
		email: input.user.email,
		phone: input.user.phone,
		isAdmin: input.user.isAdmin,
		isSuspended: input.user.suspendedAt !== null,
		businessRoles: input.businessRoles,
		orderCount: input.orderCount,
		createdAt: input.user.createdAt,
	};
}

export function adminOrderRowOf(input: {
	order: OrderRow;
	businessName: string;
	customerName: string;
}): AdminOrderRow {
	return {
		id: input.order.id,
		reference: input.order.reference,
		status: input.order.status,
		businessName: input.businessName,
		customerName: input.customerName,
		totalMinor: input.order.totalMinor,
		currency: currencyOf(input.order.currency),
		paymentStatus: input.order.paymentStatus,
		placedAt: input.order.placedAt,
	};
}

export { FALLBACK_CURRENCY };

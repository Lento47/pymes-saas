/**
 * The marketplace model, in SQLite dialect because the only database behind it is
 * Cloudflare D1 — and D1 speaks SQLite, not Postgres. That decision removes a
 * driver adapter and an engine binary from the deploy, and it is also why the
 * column types below look like this:
 *
 * - **Timestamps are integers in milliseconds.** SQLite has no date type, and the
 *   two ways to fake one agree on nothing: a `TEXT` column sorts correctly only
 *   while every writer formats it the same way, and a `INTEGER` in *seconds*
 *   silently collides with the `Date.now()` a caller already has in hand. `_ms`
 *   is the one representation that both `new Date()` and `Date.now()` round-trip
 *   without a conversion at the call site, and comparisons in SQL stay integer
 *   comparisons.
 * - **Booleans are integers.** SQLite has no boolean either. The `{ mode:
 *   "boolean" }` mapping is what keeps `isAdmin` from arriving as `0 | 1` in
 *   every service that reads it.
 * - **Money is an integer in the currency's minor unit** — never a float, never a
 *   `REAL`. ₡1 500 and $15.00 are stored as `1500` and `1500` with the currency
 *   column saying which. See the ADR: the bug this prevents is a CRC price
 *   rendered at a hundredth of its value.
 * - **JSON is text.** `{ mode: "json" }` parses it on read; nothing in SQLite
 *   queries inside it, so a column that needs querying gets a column.
 *
 * Ids are prefixed strings (`ord_…`) minted by `newId()` in the API, so no column
 * here has a default. An identity chosen by the database cannot be known before
 * the write, and a client that has to wait for a round trip to learn what it just
 * created is a client that renders a spinner over a row it already has.
 */

import type { BusinessHoursEntry, LocationPauseReason } from "@pymeshub/shared";
import type { Currency } from "@pymeshub/shared/money";
import type {
	FulfilmentKind,
	OrderActor,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
} from "@pymeshub/shared/order-state";
import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// The unions the columns below are typed with.
//
// `packages/shared` declares four of these too, and the two definitions are
// structurally identical, so the duplication is deliberate rather than an
// oversight: importing them as *values* from the shared barrel would make every
// runtime consumer of this package — the Worker included — evaluate every zod
// schema in the repository on import, and a schema that throws at module scope
// would then take the API down at boot rather than at the call site that wanted
// it. `import type` is erased and costs nothing; a value re-export is not.
//
// The duplication is safe because the types are unions of string literals: two
// declarations of the same union are interchangeable, so a value produced by a
// shared schema assigns to a column here without a cast.
// ---------------------------------------------------------------------------

export const BUSINESS_STATUSES = [
	"DRAFT",
	"ACTIVE",
	"SUSPENDED",
	"CLOSED",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const MEMBERSHIP_ROLES = [
	"OWNER",
	"MANAGER",
	"STAFF",
	"COURIER",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const COURIER_VERIFICATION_STATUSES = [
	"PENDING",
	"VERIFIED",
	"REJECTED",
] as const;
export type CourierVerificationStatus =
	(typeof COURIER_VERIFICATION_STATUSES)[number];

export const COURIER_INVITE_STATUSES = [
	"PENDING",
	"ACCEPTED",
	"DECLINED",
	"EXPIRED",
	"CANCELLED",
] as const;
export type CourierInviteStatus = (typeof COURIER_INVITE_STATUSES)[number];

export const DELIVERY_STATUSES = [
	"SEARCHING",
	"OFFERED",
	"ACCEPTED",
	"TO_PICKUP",
	"AT_PICKUP",
	"PICKED_UP",
	"DELIVERED",
	"CANCELLED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_OFFER_STATUSES = [
	"PENDING",
	"ACCEPTED",
	"DECLINED",
	"EXPIRED",
	"CANCELLED",
] as const;
export type DeliveryOfferStatus = (typeof DELIVERY_OFFER_STATUSES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CART_STATUSES = ["OPEN", "CHECKED_OUT", "ABANDONED"] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const OPTION_GROUP_KINDS = ["SINGLE", "MULTI"] as const;
export type OptionGroupKind = (typeof OPTION_GROUP_KINDS)[number];

export const PROMOTION_KINDS = ["PERCENT", "FIXED", "FREE_DELIVERY"] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const PAYOUT_STATUSES = ["PENDING", "PAID", "FAILED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * One chosen option, as it was priced at the moment it was chosen. Order lines
 * and cart lines share the shape on purpose: promoting a cart is a copy, and a
 * copy that needs a translation step is a copy that can lose a price.
 */
export type ChosenOption = {
	groupId: string;
	groupName: string;
	optionId: string;
	name: string;
	/** Signed: a smaller size is a negative delta. */
	priceDeltaMinor: number;
};

// ---------------------------------------------------------------------------
// Identity — the domain's own row
//
// Identity lives in D1 too, in the `auth_*` tables declared in `./auth-schema.ts`
// (`auth_session`, `auth_account`, `auth_verification`, `auth_rate_limit`).
// Better Auth owns those and its drizzle adapter writes them directly: the
// password hash, the OAuth handshake and the session are its rows, not ours, so
// there is nothing to mirror. They reference `user.id`, which makes this table
// the domain half of one identity rather than a copy of a foreign one.
//
// What lives here is the part that is the marketplace's: the display name and
// avatar a storefront shows, the phone a courier rings, the admin flag, and
// whether we have suspended the account. `email` stays because it is the one
// field that has to be unique — two businesses must not be able to claim the
// same person — and the columns are the shape Better Auth's own user model
// expects, so no join between the two needs a translation step.
// ---------------------------------------------------------------------------

export const user = sqliteTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		emailVerified: integer("email_verified", { mode: "boolean" })
			.notNull()
			.default(false),
		image: text("image"),
		phone: text("phone"),
		/**
		 * A platform capability rather than a membership: "can suspend a business"
		 * is not something a business grants, so no membership can ever confer it
		 * and no sign-up path can set it. It is set in SQL.
		 */
		isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
		/**
		 * Set by an admin, cleared by an admin. Better Auth can expire a session,
		 * but "this person may not trade here" is the marketplace's rule and has to
		 * outlive every session that person could open — which is why it is a
		 * timestamp on our row rather than a flag we ask the auth layer to hold.
		 */
		suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
		/**
		 * The customer's own notification switches. All default to true, which
		 * is exactly today's behaviour — every write still happens until the
		 * reader turns one off — so the migration changes no inbox. The queue
		 * consumer (`apps/api/src/queue.ts`) and `services/reviews.ts` read
		 * these before writing; a switch the writers ignored would be
		 * decoration, and the enforcement lives beside each write rather than
		 * in the procedures that flip the values.
		 *
		 * Only two kinds exist because only two producers write customer rows:
		 * order updates and review replies. Promotions and new-store alerts
		 * have no producer anywhere, so columns for them would be schema for a
		 * fantasy — they arrive with the producer that needs them, not before.
		 */
		notifyOrderUpdates: integer("notify_order_updates", {
			mode: "boolean",
		})
			.notNull()
			.default(true),
		notifyReviewReplies: integer("notify_review_replies", {
			mode: "boolean",
		})
			.notNull()
			.default(true),
		/**
		 * Whether the public review payload may carry this person's avatar.
		 * `services/reviews.ts` nulls the image when this is false; the display
		 * name stays, because an anonymous review is a different product from
		 * an unattributed one and nobody asked for that.
		 */
		showReviewAvatar: integer("show_review_avatar", { mode: "boolean" })
			.notNull()
			.default(true),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [uniqueIndex("user_email_unique").on(table.email)],
);

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export const business = sqliteTable(
	"business",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		logoUrl: text("logo_url"),
		coverUrl: text("cover_url"),
		phone: text("phone"),
		email: text("email"),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		line1: text("line1"),
		line2: text("line2"),
		city: text("city"),
		region: text("region"),
		country: text("country"),
		postalCode: text("postal_code"),
		/**
		 * Nullable because a business is created before it is placed: the draft a
		 * new owner fills in has no coordinates until the address step, and a NOT
		 * NULL here would turn "not finished yet" into a failed insert.
		 */
		lat: real("lat"),
		lng: real("lng"),
		/** Written whenever lat/lng change. See `src/geo.ts`. */
		geohash: text("geohash"),
		/** Fixed at creation: an order is priced in the currency it was made in. */
		currency: text("currency").$type<Currency>().notNull(),
		status: text("status").$type<BusinessStatus>().notNull().default("DRAFT"),
		isVerified: integer("is_verified", { mode: "boolean" })
			.notNull()
			.default(false),
		ratingAvg: real("rating_avg").notNull().default(0),
		ratingCount: integer("rating_count").notNull().default(0),
		deliveryEnabled: integer("delivery_enabled", { mode: "boolean" })
			.notNull()
			.default(false),
		pickupEnabled: integer("pickup_enabled", { mode: "boolean" })
			.notNull()
			.default(true),
		deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
		deliveryRadiusKm: real("delivery_radius_km"),
		prepTimeMinutes: integer("prep_time_minutes"),
		minOrderMinor: integer("min_order_minor").notNull().default(0),
		/**
		 * Opening hours as JSON, one entry per weekday, in **local wall-clock
		 * minutes** (`opensMinute: 540` is 09:00). Wall clock rather than UTC
		 * because "we open at 9" is a fact about the shop, not about the reader — a
		 * customer in another timezone still means 9am in San José, and storing an
		 * instant would make the shop appear to open at a different hour under DST
		 * or a viewer's locale change.
		 *
		 * The shape is `BusinessHoursEntry[]` in `@pymeshub/shared`
		 * (`schemas/business.ts`), which also owns the refinement that
		 * `closesMinute > opensMinute` unless the day is closed. It is JSON rather
		 * than a table because hours are always read as a whole set and never
		 * queried across businesses — an `isOpenNow` filter reads the business row
		 * it already has, then evaluates hours in memory.
		 */
		hours: text("hours", { mode: "json" }).$type<BusinessHoursEntry[]>(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("business_slug_unique").on(table.slug),
		// The "near me" query: a geohash prefix narrows to a cell, the status filter
		// drops what a customer may not see, and both are in the same index so the
		// narrowing is not a scan.
		index("business_geohash_status_idx").on(table.geohash, table.status),
	],
);

/** One physical place belonging to a merchant. The old business address remains the
 * legacy storefront default until every customer surface selects a location. */
export const merchantLocation = sqliteTable(
	"merchant_location",
	{
		id: text("id").primaryKey(),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		line1: text("line1"),
		line2: text("line2"),
		city: text("city"),
		region: text("region"),
		country: text("country"),
		postalCode: text("postal_code"),
		lat: real("lat"),
		lng: real("lng"),
		hours: text("hours", { mode: "json" }).$type<BusinessHoursEntry[]>(),
		pauseReason: text("pause_reason").$type<LocationPauseReason>(),
		pausedAt: integer("paused_at", { mode: "timestamp_ms" }),
		resumeAt: integer("resume_at", { mode: "timestamp_ms" }),
		isOffline: integer("is_offline", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("merchant_location_business_idx").on(table.businessId),
		uniqueIndex("merchant_location_default_unique")
			.on(table.businessId)
			.where(sql`${table.isDefault} = 1`),
	],
);

/**
 * A user's role inside one business. A customer has none — the absence of a row
 * is what makes them a customer, which is why this is not a `role` column on
 * `user`.
 */
export const membership = sqliteTable(
	"membership",
	{
		id: text("id").primaryKey(),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").$type<MembershipRole>().notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("membership_business_user_unique").on(
			table.businessId,
			table.userId,
		),
		// Every request resolves the caller's memberships before it resolves
		// anything else, so this is the hottest read in the tenancy model.
		index("membership_user_idx").on(table.userId),
	],
);

/**
 * A courier's public, opt-in profile. The account row is not enough: a
 * business must be able to find a person who chose to be discoverable without
 * exposing an email address or turning every account into a directory row.
 *
 * Verification is a platform decision. A business cannot write this table, and
 * a profile that changes meaningful fields returns to PENDING for review.
 */
export const courierProfile = sqliteTable(
	"courier_profile",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		displayName: text("display_name").notNull(),
		serviceArea: text("service_area").notNull(),
		bio: text("bio"),
		/**
		 * The vehicle a courier rides, added with the profile's own photo work:
		 * what the platform reviews is the person, but what a delivery run needs
		 * is a plate to identify the vehicle and a picture a business can
		 * recognize it by. Nullable: a courier without a vehicle row yet is the
		 * normal state before the first delivery.
		 */
		vehicleName: text("vehicle_name"),
		vehiclePlate: text("vehicle_plate"),
		vehiclePhotoUrl: text("vehicle_photo_url"),
		isAvailable: integer("is_available", { mode: "boolean" })
			.notNull()
			.default(true),
		verificationStatus: text("verification_status")
			.$type<CourierVerificationStatus>()
			.notNull()
			.default("PENDING"),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
		reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("courier_profile_user_unique").on(table.userId),
		index("courier_profile_directory_idx").on(
			table.verificationStatus,
			table.isAvailable,
		),
	],
);

/**
 * A business's request for a courier. It is deliberately a separate row from
 * membership: acceptance is the only event that creates a COURIER membership.
 */
export const courierInvite = sqliteTable(
	"courier_invite",
	{
		id: text("id").primaryKey(),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		courierUserId: text("courier_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		profileId: text("profile_id")
			.notNull()
			.references(() => courierProfile.id, { onDelete: "cascade" }),
		invitedByUserId: text("invited_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		status: text("status")
			.$type<CourierInviteStatus>()
			.notNull()
			.default("PENDING"),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("courier_invite_pending_unique")
			.on(table.businessId, table.courierUserId)
			.where(sql`${table.status} = 'PENDING'`),
		index("courier_invite_business_status_idx").on(
			table.businessId,
			table.status,
			table.createdAt,
		),
		index("courier_invite_courier_status_idx").on(
			table.courierUserId,
			table.status,
			table.createdAt,
		),
	],
);

/** The courier's latest foreground position. History is deliberately not kept. */
export const courierPresence = sqliteTable(
	"courier_presence",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lat: real("lat").notNull(),
		lng: real("lng").notNull(),
		accuracyMeters: real("accuracy_meters"),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("courier_presence_user_unique").on(table.userId),
		index("courier_presence_updated_idx").on(table.updatedAt),
	],
);

export const category = sqliteTable(
	"category",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		/** Spanish, and the column every existing reader draws. `en` is the second locale. */
		name: text("name").notNull(),
		/**
		 * The same name in English, for `SUPPORTED_LOCALES`' second member.
		 *
		 * Nullable because it is not translated for every row — the six categories the demo
		 * seed writes have no English name — and a client showing `en` falls back to `name`
		 * rather than drawing an empty chip. A row whose English name is genuinely the same
		 * word ("Golf", "Parking") still carries it, so "missing" and "identical" stay
		 * different facts.
		 */
		nameEn: text("name_en"),
		iconName: text("icon_name"),
		imageUrl: text("image_url"),
		/** Two levels at most: a parent is a grouping, not a tree. */
		parentId: text("parent_id").references((): AnySQLiteColumn => category.id, {
			onDelete: "set null",
		}),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [uniqueIndex("category_slug_unique").on(table.slug)],
);

export const product = sqliteTable(
	"product",
	{
		id: text("id").primaryKey(),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		categoryId: text("category_id").references(() => category.id, {
			onDelete: "set null",
		}),
		name: text("name").notNull(),
		description: text("description"),
		imageUrl: text("image_url"),
		images: text("images", { mode: "json" }).$type<string[]>(),
		priceMinor: integer("price_minor").notNull(),
		/** The struck-through price. Must exceed `priceMinor`, or be null. */
		compareAtPriceMinor: integer("compare_at_price_minor"),
		currency: text("currency").$type<Currency>().notNull(),
		sku: text("sku"),
		status: text("status").$type<ProductStatus>().notNull().default("DRAFT"),
		isFeatured: integer("is_featured", { mode: "boolean" })
			.notNull()
			.default(false),
		trackInventory: integer("track_inventory", { mode: "boolean" })
			.notNull()
			.default(false),
		stockQuantity: integer("stock_quantity").notNull().default(0),
		prepTimeMinutes: integer("prep_time_minutes"),
		tags: text("tags", { mode: "json" }).$type<string[]>(),
		ratingAvg: real("rating_avg").notNull().default(0),
		ratingCount: integer("rating_count").notNull().default(0),
		soldCount: integer("sold_count").notNull().default(0),
		sortOrder: integer("sort_order").notNull().default(0),
		/** Archived, never deleted: an order line points here. */
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		// The business's own catalogue, and the storefront's browse-by-category.
		index("product_business_status_idx").on(table.businessId, table.status),
		index("product_category_status_idx").on(table.categoryId, table.status),
	],
);

export const productOptionGroup = sqliteTable("product_option_group", {
	id: text("id").primaryKey(),
	productId: text("product_id")
		.notNull()
		.references(() => product.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	kind: text("kind").$type<OptionGroupKind>().notNull(),
	isRequired: integer("is_required", { mode: "boolean" })
		.notNull()
		.default(false),
	minSelect: integer("min_select").notNull().default(0),
	maxSelect: integer("max_select").notNull().default(1),
	sortOrder: integer("sort_order").notNull().default(0),
});

export const productOption = sqliteTable("product_option", {
	id: text("id").primaryKey(),
	groupId: text("group_id")
		.notNull()
		.references(() => productOptionGroup.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	/** Signed — a smaller size is a negative delta, not a second price. */
	priceDeltaMinor: integer("price_delta_minor").notNull().default(0),
	isDefault: integer("is_default", { mode: "boolean" })
		.notNull()
		.default(false),
	isAvailable: integer("is_available", { mode: "boolean" })
		.notNull()
		.default(true),
	sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * A cart belongs to exactly one business, fixed when the first item is added.
 * The column is not derivable from the items on purpose: a merged cart — items
 * from two businesses in one — is an order neither business can fulfil, and the
 * failure surfaces at checkout as a delivery fee that makes no sense.
 */
export const cart = sqliteTable(
	"cart",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		status: text("status").$type<CartStatus>().notNull().default("OPEN"),
		currency: text("currency").$type<Currency>().notNull(),
		promotionCode: text("promotion_code"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("cart_user_status_idx").on(table.userId, table.status)],
);

export const cartItem = sqliteTable(
	"cart_item",
	{
		id: text("id").primaryKey(),
		cartId: text("cart_id")
			.notNull()
			.references(() => cart.id, { onDelete: "cascade" }),
		productId: text("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		quantity: integer("quantity").notNull().default(1),
		unitPriceMinor: integer("unit_price_minor").notNull(),
		options: text("options", { mode: "json" }).$type<ChosenOption[]>(),
		/**
		 * The chosen options, hashed. It exists so the unique index below can tell
		 * "the same product with different options" (two lines) from "the same
		 * product with the same options" (one line, a bigger quantity) — JSON is
		 * text and two orderings of the same choices are two different strings.
		 */
		optionsHash: text("options_hash").notNull(),
		notes: text("notes"),
	},
	(table) => [
		uniqueIndex("cart_item_cart_product_options_unique").on(
			table.cartId,
			table.productId,
			table.optionsHash,
		),
	],
);

export const address = sqliteTable(
	"address",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		label: text("label"),
		line1: text("line1").notNull(),
		line2: text("line2"),
		city: text("city").notNull(),
		region: text("region"),
		country: text("country").notNull(),
		postalCode: text("postal_code"),
		lat: real("lat"),
		lng: real("lng"),
		phone: text("phone"),
		instructions: text("instructions"),
		/** At most one per user. A partial index cannot say that, so the service does. */
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
	},
	(table) => [index("address_user_idx").on(table.userId)],
);

export const order = sqliteTable(
	"order",
	{
		id: text("id").primaryKey(),
		/** What a customer reads over the phone. Separate from the id, which stays internal. */
		reference: text("reference").notNull(),
		customerId: text("customer_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "restrict" }),
		locationId: text("location_id").references(() => merchantLocation.id, {
			onDelete: "restrict",
		}),
		addressId: text("address_id").references(() => address.id, {
			onDelete: "set null",
		}),
		fulfilment: text("fulfilment").$type<FulfilmentKind>().notNull(),
		status: text("status").$type<OrderStatus>().notNull().default("PENDING"),
		/**
		 * How many times this order has moved, starting at 1 when it is placed.
		 *
		 * It exists so an event can say *which* version of the order it describes, and it is
		 * only worth having if it is genuinely monotonic — so the write that moves an order
		 * reserves this number with a compare-and-set, never a read-then-write in JavaScript.
		 * No two events therefore claim the same version of one order. `applyMove` in
		 * `apps/api/src/services/orders.ts` states the one case that guard does not cover.
		 *
		 * It is not an identity and must never be used as one. Every order has a version 1,
		 * so the number means nothing without an `aggregateId` beside it, and deduplication
		 * is `eventId`'s job — a key built from an aggregate and a version is the shape that
		 * silently swallows a legitimate repeat.
		 */
		version: integer("version").notNull().default(1),
		paymentMethod: text("payment_method").$type<PaymentMethod>().notNull(),
		paymentStatus: text("payment_status")
			.$type<PaymentStatus>()
			.notNull()
			.default("UNPAID"),
		currency: text("currency").$type<Currency>().notNull(),
		/**
		 * Totals are stored rather than recomputed from the lines. They are what the
		 * customer agreed to, and a price change must never rewrite a receipt.
		 */
		subtotalMinor: integer("subtotal_minor").notNull(),
		discountMinor: integer("discount_minor").notNull().default(0),
		deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
		taxMinor: integer("tax_minor").notNull().default(0),
		tipMinor: integer("tip_minor").notNull().default(0),
		totalMinor: integer("total_minor").notNull(),
		notes: text("notes"),
		scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
		placedAt: integer("placed_at", { mode: "timestamp_ms" }).notNull(),
		acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
		readyAt: integer("ready_at", { mode: "timestamp_ms" }),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
		cancelReason: text("cancel_reason"),
		courierName: text("courier_name"),
		courierPhone: text("courier_phone"),
		/**
		 * The assigned courier, when a manager has handed the run to somebody.
		 * An id rather than the typed name above: `advanceOrderInput` still
		 * accepts a free-text name for the legacy path, but once an assignee
		 * exists the row's name and phone come from the member's own profile
		 * and the typed values are ignored. Null until assigned.
		 */
		courierUserId: text("courier_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		/**
		 * The last foreground ping from the assigned courier's phone, and when
		 * it landed. One row of position, overwritten in place: history of
		 * where a courier has been is a tracking product this is not, and a
		 * table of pings would answer "where were you at 19:04" to anyone who
		 * can read an order. Stale means backgrounded, never stopped.
		 */
		courierLat: real("courier_lat"),
		courierLng: real("courier_lng"),
		courierAt: integer("courier_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("order_reference_unique").on(table.reference),
		// The customer's order history, newest first.
		index("order_customer_placed_idx").on(table.customerId, table.placedAt),
		// The business's incoming-orders board: one status column, newest first.
		index("order_business_status_placed_idx").on(
			table.businessId,
			table.status,
			table.placedAt,
		),
		index("order_location_status_placed_idx").on(
			table.locationId,
			table.status,
			table.placedAt,
		),
	],
);

/**
 * One physical delivery for one DELIVERY order. Both stops are snapshots: an
 * edited address must not move a run that a courier already accepted.
 */
export const delivery = sqliteTable(
	"delivery",
	{
		id: text("id").primaryKey(),
		orderId: text("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "restrict" }),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		courierUserId: text("courier_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		status: text("status").$type<DeliveryStatus>().notNull().default("SEARCHING"),
		pickupName: text("pickup_name").notNull(),
		pickupLine1: text("pickup_line1").notNull(),
		pickupLine2: text("pickup_line2"),
		pickupCity: text("pickup_city").notNull(),
		pickupRegion: text("pickup_region").notNull(),
		pickupPostalCode: text("pickup_postal_code"),
		pickupLat: real("pickup_lat"),
		pickupLng: real("pickup_lng"),
		pickupPhone: text("pickup_phone"),
		pickupInstructions: text("pickup_instructions"),
		dropoffName: text("dropoff_name").notNull(),
		dropoffLine1: text("dropoff_line1").notNull(),
		dropoffLine2: text("dropoff_line2"),
		dropoffCity: text("dropoff_city").notNull(),
		dropoffRegion: text("dropoff_region").notNull(),
		dropoffPostalCode: text("dropoff_postal_code"),
		dropoffLat: real("dropoff_lat"),
		dropoffLng: real("dropoff_lng"),
		dropoffPhone: text("dropoff_phone"),
		dropoffInstructions: text("dropoff_instructions"),
		acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
		startedToPickupAt: integer("started_to_pickup_at", { mode: "timestamp_ms" }),
		arrivedPickupAt: integer("arrived_pickup_at", { mode: "timestamp_ms" }),
		pickedUpAt: integer("picked_up_at", { mode: "timestamp_ms" }),
		deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("delivery_order_unique").on(table.orderId),
		index("delivery_courier_status_idx").on(table.courierUserId, table.status),
		index("delivery_business_status_idx").on(table.businessId, table.status),
	],
);

/** One timed offer in the automatic dispatch sequence. */
export const deliveryOffer = sqliteTable(
	"delivery_offer",
	{
		id: text("id").primaryKey(),
		deliveryId: text("delivery_id")
			.notNull()
			.references(() => delivery.id, { onDelete: "cascade" }),
		courierUserId: text("courier_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status")
			.$type<DeliveryOfferStatus>()
			.notNull()
			.default("PENDING"),
		distanceToPickupKm: real("distance_to_pickup_km"),
		workloadAtOffer: integer("workload_at_offer").notNull().default(0),
		ratingAtOffer: real("rating_at_offer"),
		expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
		respondedAt: integer("responded_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("delivery_offer_courier_unique").on(
			table.deliveryId,
			table.courierUserId,
		),
		uniqueIndex("delivery_offer_pending_unique")
			.on(table.deliveryId)
			.where(sql`${table.status} = 'PENDING'`),
		uniqueIndex("delivery_offer_accepted_unique")
			.on(table.deliveryId)
			.where(sql`${table.status} = 'ACCEPTED'`),
		index("delivery_offer_courier_status_idx").on(
			table.courierUserId,
			table.status,
			table.expiresAt,
		),
	],
);

/** Exactly one rating in each direction after a delivered run. */
export const deliveryRating = sqliteTable(
	"delivery_rating",
	{
		id: text("id").primaryKey(),
		deliveryId: text("delivery_id")
			.notNull()
			.references(() => delivery.id, { onDelete: "cascade" }),
		fromUserId: text("from_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		toUserId: text("to_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		fromRole: text("from_role").$type<"CUSTOMER" | "COURIER">().notNull(),
		rating: integer("rating").notNull(),
		comment: text("comment"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("delivery_rating_direction_unique").on(
			table.deliveryId,
			table.fromRole,
		),
		index("delivery_rating_recipient_idx").on(table.toUserId, table.createdAt),
	],
);

/**
 * A line, snapshotted. It carries the name, the image and the unit price as they
 * were when the order was placed, because a business renaming a product must not
 * rewrite last week's receipts — and a customer disputing a charge has to be able
 * to see what they actually agreed to.
 *
 * Neither foreign key cascades. Orders are never deleted; if one ever needs to
 * be, the delete should fail loudly rather than take the history with it.
 */
export const orderItem = sqliteTable("order_item", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => order.id, { onDelete: "restrict" }),
	productId: text("product_id")
		.notNull()
		.references(() => product.id, { onDelete: "restrict" }),
	nameSnapshot: text("name_snapshot").notNull(),
	imageUrlSnapshot: text("image_url_snapshot"),
	quantity: integer("quantity").notNull(),
	unitPriceMinor: integer("unit_price_minor").notNull(),
	options: text("options", { mode: "json" }).$type<ChosenOption[]>(),
	lineTotalMinor: integer("line_total_minor").notNull(),
	notes: text("notes"),
});

/**
 * The history, one row per status change. Status is the current value; these are
 * how it got there. Deriving either from the other is how a tracker loses a step
 * — a customer watching a delivery needs the sequence, not just the destination.
 */
export const orderEvent = sqliteTable(
	"order_event",
	{
		id: text("id").primaryKey(),
		orderId: text("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "restrict" }),
		/** Null on the row that records the order being placed: nothing preceded it. */
		fromStatus: text("from_status").$type<OrderStatus>(),
		toStatus: text("to_status").$type<OrderStatus>().notNull(),
		actor: text("actor").$type<OrderActor>().notNull(),
		/** Null for SYSTEM and COURIER events: not every move was made by a user. */
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		note: text("note"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("order_event_order_created_idx").on(table.orderId, table.createdAt),
	],
);

/**
 * An event that has been *decided* but not necessarily *announced*.
 *
 * The row is inserted in the same D1 batch that writes the change it describes, which is
 * the entire point: `batch` is atomic, so "the order moved" and "there is an event about
 * it" are one fact. Sending to the queue from the request path instead — which is what
 * this replaced — leaves a window where the batch commits, the isolate dies, and a
 * confirmed order exists with nobody told about it. Nothing recovers from that, because
 * nothing knows it was supposed to happen.
 *
 * The publisher reads `publishedAt IS NULL`, sends, and marks the row **only after** the
 * send succeeded. A crash between the send and the mark re-sends, which is fine: the
 * consumer deduplicates on `eventId`. At-least-once plus an idempotent effect, rather
 * than an attempt at exactly-once that a queue cannot give.
 *
 * `aggregateVersion` is the order's version at the moment of the move, so a consumer can
 * tell a late event from a current one — and so `eventId` is not the only thing
 * distinguishing two events of the same type on the same order.
 */
export const outboxEvent = sqliteTable(
	"outbox_event",
	{
		id: text("id").primaryKey(),
		/**
		 * Stable for the life of the event. A retry of the *same* event carries the same
		 * id; two legitimate occurrences of the same `eventType` carry different ones.
		 * This is the consumer's dedupe key, and it is a stronger one than
		 * `type:aggregateId`, which silently collapses the second occurrence.
		 */
		eventId: text("event_id").notNull(),
		/** `order` today; `delivery`, `payout` when those exist. */
		aggregateType: text("aggregate_type").notNull(),
		aggregateId: text("aggregate_id").notNull(),
		/**
		 * Monotonic within the aggregate. Not `version` on its own — an event can describe
		 * a fact whose version is not the aggregate's current one — but it is what makes
		 * "is this event stale?" answerable rather than guesswork.
		 */
		aggregateVersion: integer("aggregate_version").notNull(),
		/**
		 * Denormalised out of `payload` so the table can be queried and indexed by type
		 * without walking JSON — "show me every payout event today" is a `where` clause,
		 * not a scan. It is written by the one factory that also builds the payload, so
		 * the two cannot disagree.
		 */
		eventType: text("event_type").notNull(),
		/** ISO 8601. The server's clock, never a client's. */
		occurredAt: text("occurred_at").notNull(),
		/** The message body, exactly as it goes on the queue. */
		payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
		/**
		 * Null until the send succeeded. Never set optimistically on the way in: a row
		 * marked published but never sent is an event lost with a receipt saying otherwise.
		 */
		publishedAt: integer("published_at", { mode: "timestamp_ms" }),
		/**
		 * Counts attempts, so a row that keeps failing is visible rather than merely old.
		 * The publisher does not give up on it — the queue's own retries and DLQ are where
		 * a poison message is handled — but a number that only grows is how a human finds
		 * out something is wrong before a customer does.
		 */
		attempts: integer("attempts").notNull().default(0),
		/** The last failure, for whoever reads the row after the alert. */
		lastError: text("last_error"),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("outbox_event_id_unique").on(table.eventId),
		// The publisher's whole query: unpublished, oldest first.
		index("outbox_pending_idx").on(table.publishedAt, table.createdAt),
		// The aggregate's history, for replay and for "what happened to this order".
		index("outbox_aggregate_idx").on(
			table.aggregateType,
			table.aggregateId,
			table.aggregateVersion,
		),
	],
);

/**
 * One review per order, and only from someone who received it. The unique
 * `orderId` is the whole anti-spam design: an unconstrained review table is a
 * five-star average with nothing behind it.
 */
export const review = sqliteTable(
	"review",
	{
		id: text("id").primaryKey(),
		orderId: text("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "restrict" }),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		/** Null when the review is about the business rather than one product. */
		productId: text("product_id").references(() => product.id, {
			onDelete: "set null",
		}),
		rating: integer("rating").notNull(),
		comment: text("comment"),
		/**
		 * The shop's answer, stored on the review it answers — not as a
		 * notification row. The telling (the inbox row) and the answering used
		 * to be one insert, which made "don't tell me" delete the answer: a
		 * customer who turned reply alerts off would erase the reply from the
		 * storefront too. Both nullable: a review starts unanswered.
		 */
		replyText: text("reply_text"),
		repliedAt: integer("replied_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("review_order_unique").on(table.orderId),
		index("review_business_created_idx").on(table.businessId, table.createdAt),
	],
);

/**
 * Two partial unique indexes rather than one nullable pair: SQLite treats every
 * NULL as distinct, so a `(userId, businessId, productId)` unique index would
 * happily accept the same business twice. Splitting it by which axis is set is
 * what makes "favourited once" true for both kinds of favourite.
 */
export const favorite = sqliteTable(
	"favorite",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		businessId: text("business_id").references(() => business.id, {
			onDelete: "cascade",
		}),
		productId: text("product_id").references(() => product.id, {
			onDelete: "cascade",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		uniqueIndex("favorite_user_business_unique")
			.on(table.userId, table.businessId)
			.where(sql`product_id is null`),
		uniqueIndex("favorite_user_product_unique")
			.on(table.userId, table.productId)
			.where(sql`business_id is null`),
	],
);

export const promotion = sqliteTable(
	"promotion",
	{
		id: text("id").primaryKey(),
		businessId: text("business_id")
			.notNull()
			.references(() => business.id, { onDelete: "cascade" }),
		code: text("code").notNull(),
		kind: text("kind").$type<PromotionKind>().notNull(),
		/** PERCENT is a whole percent; FIXED is minor units; FREE_DELIVERY ignores it. */
		value: integer("value").notNull(),
		minOrderMinor: integer("min_order_minor"),
		/** Null is unlimited. */
		maxRedemptions: integer("max_redemptions"),
		redemptions: integer("redemptions").notNull().default(0),
		startsAt: integer("starts_at", { mode: "timestamp_ms" }),
		endsAt: integer("ends_at", { mode: "timestamp_ms" }),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		uniqueIndex("promotion_business_code_unique").on(
			table.businessId,
			table.code,
		),
	],
);

export const notification = sqliteTable(
	"notification",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		/** What the client needs to deep-link back to the thing being announced. */
		data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
		/**
		 * Idempotency key for the queue consumer. A queue is at-least-once, so the
		 * same order event can be delivered twice; the consumer writes
		 * `"event:<eventId>:<userId>"` and relies on this index to make the second
		 * delivery a no-op. Built from what identifies the *event*, never from a
		 * timestamp — a timestamped key would make every delivery unique and the
		 * index would buy nothing.
		 *
		 * The event id, and not the message's shape: `"ORDER_STATUS_CHANGED:<orderId>"`
		 * was the first spelling of this, and it collapsed the four transitions of one
		 * order into a single notification without logging anything. See
		 * `apps/api/src/events.ts`.
		 *
		 * The trailing `userId` is there because one event now has more than one effect —
		 * every member of the business is told — and the key has to be unique per *effect*,
		 * not per event, or the fan-out would deduplicate itself down to one recipient.
		 *
		 * Nullable because a notification written synchronously by a request (a
		 * reply to a review) has no delivery to deduplicate, and SQLite treats each
		 * NULL as distinct in a unique index, so those rows never collide.
		 */
		dedupeKey: text("dedupe_key"),
		readAt: integer("read_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("notification_user_created_idx").on(table.userId, table.createdAt),
		uniqueIndex("notification_dedupe_unique").on(table.dedupeKey),
	],
);

export const payout = sqliteTable("payout", {
	id: text("id").primaryKey(),
	businessId: text("business_id")
		.notNull()
		.references(() => business.id, { onDelete: "restrict" }),
	periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
	periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
	grossMinor: integer("gross_minor").notNull(),
	platformFeeMinor: integer("platform_fee_minor").notNull(),
	netMinor: integer("net_minor").notNull(),
	status: text("status").$type<PayoutStatus>().notNull().default("PENDING"),
	paidAt: integer("paid_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Every admin mutation writes one of these. The table is the answer to "who
 * suspended this business", which is a question a platform with an admin role
 * has to be able to answer without asking the admin.
 */
export const auditLog = sqliteTable(
	"audit_log",
	{
		id: text("id").primaryKey(),
		/** Null once the admin's account is gone; the record of the act stays. */
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		action: text("action").notNull(),
		targetType: text("target_type").notNull(),
		targetId: text("target_id").notNull(),
		meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("audit_log_target_idx").on(table.targetType, table.targetId),
		index("audit_log_actor_created_idx").on(table.actorUserId, table.createdAt),
	],
);

/**
 * One row per object in R2, so an object whose row is gone — or a row whose
 * object is gone — is findable rather than merely paid for.
 */
export const upload = sqliteTable(
	"upload",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		ownerUserId: text("owner_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [uniqueIndex("upload_key_unique").on(table.key)],
);

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Business = typeof business.$inferSelect;
export type NewBusiness = typeof business.$inferInsert;

export type Membership = typeof membership.$inferSelect;
export type NewMembership = typeof membership.$inferInsert;

export type CourierProfile = typeof courierProfile.$inferSelect;
export type NewCourierProfile = typeof courierProfile.$inferInsert;

export type CourierInvite = typeof courierInvite.$inferSelect;
export type NewCourierInvite = typeof courierInvite.$inferInsert;
export type CourierPresence = typeof courierPresence.$inferSelect;
export type NewCourierPresence = typeof courierPresence.$inferInsert;

export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;

export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;

export type ProductOptionGroup = typeof productOptionGroup.$inferSelect;
export type NewProductOptionGroup = typeof productOptionGroup.$inferInsert;

export type ProductOption = typeof productOption.$inferSelect;
export type NewProductOption = typeof productOption.$inferInsert;

export type Cart = typeof cart.$inferSelect;
export type NewCart = typeof cart.$inferInsert;

export type CartItem = typeof cartItem.$inferSelect;
export type NewCartItem = typeof cartItem.$inferInsert;

export type Address = typeof address.$inferSelect;
export type NewAddress = typeof address.$inferInsert;

export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Delivery = typeof delivery.$inferSelect;
export type NewDelivery = typeof delivery.$inferInsert;
export type DeliveryOffer = typeof deliveryOffer.$inferSelect;
export type NewDeliveryOffer = typeof deliveryOffer.$inferInsert;
export type DeliveryRating = typeof deliveryRating.$inferSelect;
export type NewDeliveryRating = typeof deliveryRating.$inferInsert;

export type OrderItem = typeof orderItem.$inferSelect;
export type NewOrderItem = typeof orderItem.$inferInsert;

export type OrderEvent = typeof orderEvent.$inferSelect;
export type NewOrderEvent = typeof orderEvent.$inferInsert;

export type Review = typeof review.$inferSelect;
export type NewReview = typeof review.$inferInsert;

export type Favorite = typeof favorite.$inferSelect;
export type NewFavorite = typeof favorite.$inferInsert;

export type Promotion = typeof promotion.$inferSelect;
export type NewPromotion = typeof promotion.$inferInsert;

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;

export type Payout = typeof payout.$inferSelect;
export type NewPayout = typeof payout.$inferInsert;

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

export type Upload = typeof upload.$inferSelect;
export type NewUpload = typeof upload.$inferInsert;

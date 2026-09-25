/**
 * The read paths, declared once so that a query says what it wants rather than
 * how to join it.
 *
 * These exist for the shapes `docs/domain.md` describes: a storefront page is a
 * business with its products and each product's option groups; an order detail is
 * an order with its lines, its events and the two parties; a cart is a cart with
 * its lines and the product behind each line. Hand-writing those joins is how a
 * projection drifts from the type the client was promised.
 *
 * Only the marketplace tables appear here. The auth tables — `session`, `account`,
 * `verification`, `rateLimit` — are in this same D1 database, because Better Auth runs
 * inside the Worker and stores them beside everything else. They are deliberately left
 * out: they belong to the identity provider and are read through it, so a relation
 * declared here would be a second, unowned join path into rows this package does not
 * maintain. `user` is the one table the two halves share, and it is the row every
 * marketplace table points at.
 */

import { relations } from "drizzle-orm";

import {
	address,
	auditLog,
	business,
	cart,
	cartItem,
	category,
	courierInvite,
	courierPresence,
	courierProfile,
	delivery,
	deliveryOffer,
	deliveryRating,
	favorite,
	membership,
	merchantLocation,
	notification,
	order,
	orderEvent,
	orderItem,
	payout,
	product,
	productOption,
	productOptionGroup,
	promotion,
	review,
	upload,
	user,
} from "./schema";

export const userRelations = relations(user, ({ one, many }) => ({
	memberships: many(membership),
	addresses: many(address),
	carts: many(cart),
	orders: many(order),
	reviews: many(review),
	favorites: many(favorite),
	notifications: many(notification),
	courierProfile: one(courierProfile, {
		fields: [user.id],
		references: [courierProfile.userId],
	}),
	courierInvites: many(courierInvite),
	courierPresence: one(courierPresence, {
		fields: [user.id],
		references: [courierPresence.userId],
	}),
	customerDeliveries: many(delivery, { relationName: "delivery_customer" }),
	courierDeliveries: many(delivery, { relationName: "delivery_courier" }),
	deliveryOffers: many(deliveryOffer),
	deliveryRatingsGiven: many(deliveryRating, { relationName: "delivery_rating_from" }),
	deliveryRatingsReceived: many(deliveryRating, { relationName: "delivery_rating_to" }),
	uploads: many(upload),
}));

export const businessRelations = relations(business, ({ one, many }) => ({
	category: one(category, {
		fields: [business.categoryId],
		references: [category.id],
	}),
	memberships: many(membership),
	courierInvites: many(courierInvite),
	locations: many(merchantLocation),
	products: many(product),
	orders: many(order),
	reviews: many(review),
	favorites: many(favorite),
	promotions: many(promotion),
	payouts: many(payout),
	carts: many(cart),
	deliveries: many(delivery),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
	business: one(business, {
		fields: [membership.businessId],
		references: [business.id],
	}),
	user: one(user, {
		fields: [membership.userId],
		references: [user.id],
	}),
}));

export const courierProfileRelations = relations(courierProfile, ({ one }) => ({
	user: one(user, {
		fields: [courierProfile.userId],
		references: [user.id],
	}),
	reviewedBy: one(user, {
		fields: [courierProfile.reviewedByUserId],
		references: [user.id],
	}),
}));

export const courierInviteRelations = relations(courierInvite, ({ one }) => ({
	business: one(business, {
		fields: [courierInvite.businessId],
		references: [business.id],
	}),
	courier: one(user, {
		fields: [courierInvite.courierUserId],
		references: [user.id],
	}),
	profile: one(courierProfile, {
		fields: [courierInvite.profileId],
		references: [courierProfile.id],
	}),
	invitedBy: one(user, {
		fields: [courierInvite.invitedByUserId],
		references: [user.id],
	}),
}));

export const courierPresenceRelations = relations(courierPresence, ({ one }) => ({
	user: one(user, {
		fields: [courierPresence.userId],
		references: [user.id],
	}),
}));

export const merchantLocationRelations = relations(
	merchantLocation,
	({ one, many }) => ({
		business: one(business, {
			fields: [merchantLocation.businessId],
			references: [business.id],
		}),
		orders: many(order),
	}),
);

export const categoryRelations = relations(category, ({ one, many }) => ({
	parent: one(category, {
		fields: [category.parentId],
		references: [category.id],
		relationName: "category_parent",
	}),
	children: many(category, { relationName: "category_parent" }),
	businesses: many(business),
	products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
	business: one(business, {
		fields: [product.businessId],
		references: [business.id],
	}),
	category: one(category, {
		fields: [product.categoryId],
		references: [category.id],
	}),
	optionGroups: many(productOptionGroup),
	reviews: many(review),
	favorites: many(favorite),
	cartItems: many(cartItem),
	orderItems: many(orderItem),
}));

export const productOptionGroupRelations = relations(
	productOptionGroup,
	({ one, many }) => ({
		product: one(product, {
			fields: [productOptionGroup.productId],
			references: [product.id],
		}),
		options: many(productOption),
	}),
);

export const productOptionRelations = relations(productOption, ({ one }) => ({
	group: one(productOptionGroup, {
		fields: [productOption.groupId],
		references: [productOptionGroup.id],
	}),
}));

export const cartRelations = relations(cart, ({ one, many }) => ({
	user: one(user, { fields: [cart.userId], references: [user.id] }),
	business: one(business, {
		fields: [cart.businessId],
		references: [business.id],
	}),
	items: many(cartItem),
}));

export const cartItemRelations = relations(cartItem, ({ one }) => ({
	cart: one(cart, { fields: [cartItem.cartId], references: [cart.id] }),
	product: one(product, {
		fields: [cartItem.productId],
		references: [product.id],
	}),
}));

export const addressRelations = relations(address, ({ one, many }) => ({
	user: one(user, { fields: [address.userId], references: [user.id] }),
	orders: many(order),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
	customer: one(user, {
		fields: [order.customerId],
		references: [user.id],
	}),
	business: one(business, {
		fields: [order.businessId],
		references: [business.id],
	}),
	location: one(merchantLocation, {
		fields: [order.locationId],
		references: [merchantLocation.id],
	}),
	address: one(address, {
		fields: [order.addressId],
		references: [address.id],
	}),
	items: many(orderItem),
	events: many(orderEvent),
	review: one(review),
	delivery: one(delivery),
}));

export const deliveryRelations = relations(delivery, ({ one, many }) => ({
	order: one(order, { fields: [delivery.orderId], references: [order.id] }),
	business: one(business, {
		fields: [delivery.businessId],
		references: [business.id],
	}),
	customer: one(user, {
		fields: [delivery.customerId],
		references: [user.id],
		relationName: "delivery_customer",
	}),
	courier: one(user, {
		fields: [delivery.courierUserId],
		references: [user.id],
		relationName: "delivery_courier",
	}),
	offers: many(deliveryOffer),
	ratings: many(deliveryRating),
}));

export const deliveryOfferRelations = relations(deliveryOffer, ({ one }) => ({
	delivery: one(delivery, {
		fields: [deliveryOffer.deliveryId],
		references: [delivery.id],
	}),
	courier: one(user, {
		fields: [deliveryOffer.courierUserId],
		references: [user.id],
	}),
}));

export const deliveryRatingRelations = relations(deliveryRating, ({ one }) => ({
	delivery: one(delivery, {
		fields: [deliveryRating.deliveryId],
		references: [delivery.id],
	}),
	fromUser: one(user, {
		fields: [deliveryRating.fromUserId],
		references: [user.id],
		relationName: "delivery_rating_from",
	}),
	toUser: one(user, {
		fields: [deliveryRating.toUserId],
		references: [user.id],
		relationName: "delivery_rating_to",
	}),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
	order: one(order, {
		fields: [orderItem.orderId],
		references: [order.id],
	}),
	product: one(product, {
		fields: [orderItem.productId],
		references: [product.id],
	}),
}));

export const orderEventRelations = relations(orderEvent, ({ one }) => ({
	order: one(order, {
		fields: [orderEvent.orderId],
		references: [order.id],
	}),
	actorUser: one(user, {
		fields: [orderEvent.actorUserId],
		references: [user.id],
	}),
}));

export const reviewRelations = relations(review, ({ one }) => ({
	order: one(order, { fields: [review.orderId], references: [order.id] }),
	business: one(business, {
		fields: [review.businessId],
		references: [business.id],
	}),
	customer: one(user, {
		fields: [review.customerId],
		references: [user.id],
	}),
	product: one(product, {
		fields: [review.productId],
		references: [product.id],
	}),
}));

export const favoriteRelations = relations(favorite, ({ one }) => ({
	user: one(user, { fields: [favorite.userId], references: [user.id] }),
	business: one(business, {
		fields: [favorite.businessId],
		references: [business.id],
	}),
	product: one(product, {
		fields: [favorite.productId],
		references: [product.id],
	}),
}));

export const promotionRelations = relations(promotion, ({ one }) => ({
	business: one(business, {
		fields: [promotion.businessId],
		references: [business.id],
	}),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
	user: one(user, { fields: [notification.userId], references: [user.id] }),
}));

export const payoutRelations = relations(payout, ({ one }) => ({
	business: one(business, {
		fields: [payout.businessId],
		references: [business.id],
	}),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	actorUser: one(user, {
		fields: [auditLog.actorUserId],
		references: [user.id],
	}),
}));

export const uploadRelations = relations(upload, ({ one }) => ({
	owner: one(user, {
		fields: [upload.ownerUserId],
		references: [user.id],
	}),
}));

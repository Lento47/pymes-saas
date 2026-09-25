/** Delivery dispatch, courier workflow, and the two post-delivery ratings. */

import { z } from "zod";

import { currencySchema, latitudeSchema, longitudeSchema } from "./common";

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

export const DELIVERY_ACTIONS = [
	"START_TO_PICKUP",
	"ARRIVE_PICKUP",
	"CONFIRM_PICKUP",
	"COMPLETE",
] as const;
export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];

export const deliveryStopSchema = z.object({
	name: z.string(),
	line1: z.string(),
	line2: z.string().nullable(),
	city: z.string(),
	region: z.string(),
	postalCode: z.string().nullable(),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	phone: z.string().nullable(),
	instructions: z.string().nullable(),
});
export type DeliveryStop = z.infer<typeof deliveryStopSchema>;

export const courierPresenceInput = z.object({
	lat: latitudeSchema,
	lng: longitudeSchema,
	accuracyMeters: z.number().nonnegative().max(10_000).optional(),
});
export type CourierPresenceInput = z.infer<typeof courierPresenceInput>;

export const deliveryRatingSchema = z.object({
	id: z.string(),
	deliveryId: z.string(),
	fromRole: z.enum(["CUSTOMER", "COURIER"]),
	rating: z.number().int().min(1).max(5),
	comment: z.string().nullable(),
	createdAt: z.date(),
});
export type DeliveryRating = z.infer<typeof deliveryRatingSchema>;

export const deliveryOfferSchema = z.object({
	id: z.string(),
	deliveryId: z.string(),
	orderId: z.string(),
	orderReference: z.string(),
	businessName: z.string(),
	status: z.enum(DELIVERY_OFFER_STATUSES),
	pickup: deliveryStopSchema,
	dropoffArea: z.string(),
	distanceToPickupKm: z.number().nonnegative().nullable(),
	expiresAt: z.date(),
	createdAt: z.date(),
});
export type DeliveryOffer = z.infer<typeof deliveryOfferSchema>;

export const deliveryDetailSchema = z.object({
	id: z.string(),
	orderId: z.string(),
	orderReference: z.string(),
	status: z.enum(DELIVERY_STATUSES),
	business: z.object({
		id: z.string(),
		name: z.string(),
		phone: z.string().nullable(),
	}),
	customer: z.object({
		id: z.string(),
		name: z.string(),
		phone: z.string().nullable(),
	}),
	courier: z
		.object({ id: z.string(), name: z.string(), phone: z.string().nullable() })
		.nullable(),
	pickup: deliveryStopSchema,
	dropoff: deliveryStopSchema,
	orderStatus: z.enum([
		"PENDING",
		"ACCEPTED",
		"REJECTED",
		"PREPARING",
		"READY",
		"OUT_FOR_DELIVERY",
		"COMPLETED",
		"CANCELLED",
	]),
	totalMinor: z.number().int(),
	currency: currencySchema,
	acceptedAt: z.date().nullable(),
	arrivedPickupAt: z.date().nullable(),
	pickedUpAt: z.date().nullable(),
	deliveredAt: z.date().nullable(),
	createdAt: z.date(),
	ratings: z.object({
		customerToCourier: deliveryRatingSchema.nullable(),
		courierToCustomer: deliveryRatingSchema.nullable(),
	}),
});
export type DeliveryDetail = z.infer<typeof deliveryDetailSchema>;

export const acceptDeliveryOfferInput = z.object({ offerId: z.string() });
export const declineDeliveryOfferInput = z.object({ offerId: z.string() });
export const deliveryByOrderInput = z.object({
	orderId: z.string().startsWith("ord_"),
});
export const deliveryByIdInput = z.object({ deliveryId: z.string() });
export const advanceDeliveryInput = z.object({
	deliveryId: z.string(),
	action: z.enum(DELIVERY_ACTIONS),
});
export const rateDeliveryInput = z.object({
	deliveryId: z.string(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().trim().max(500).optional(),
});
export type RateDeliveryInput = z.infer<typeof rateDeliveryInput>;

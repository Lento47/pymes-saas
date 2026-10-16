import { z } from "zod";

const amount = z.number().int().min(0).max(10_000_000);
/** Initial rollout: incentive funding and post-payment credits are not enabled. */
export const deliveryPricingTermsSchema = z
	.object({
		baseCRC: amount.min(1).default(850),
		perKmCRC: amount.default(230),
		perEstimatedMinuteCRC: amount.default(45),
		nearbyMaxPct: z.number().min(0).max(10).default(10),
		readyMaxPct: z.number().min(0).max(5).default(5),
		combinedMaxPct: z.number().min(0).max(15).default(15),
		nearbyMaxEtaSeconds: z.number().int().min(0).max(180).default(180),
		minContributionMarginCRC: amount.default(0),
		maxTopUpCRC: z.literal(0).default(0),
		customerPriceCapCRC: amount.nullable().default(null),
		nearbyDiscountEnabled: z.literal(false).default(false),
		readyBenefitEnabled: z.literal(false).default(false),
		dynamicTopUpEnabled: z.literal(false).default(false),
	})
	.strict();
export type DeliveryPricingTerms = z.infer<typeof deliveryPricingTermsSchema>;
export const DEFAULT_DELIVERY_PRICING_TERMS = deliveryPricingTermsSchema.parse(
	{},
);

export const deliveryPricingDraftInput = z
	.object({
		terms: deliveryPricingTermsSchema,
		expectedVersion: z.string().min(1).max(100),
		reason: z.string().trim().min(10).max(1000),
		activeFrom: z.date().optional(),
	})
	.strict();
export const publishDeliveryPricingInput = z
	.object({
		draftId: z.string().startsWith("dpp_"),
		expectedVersion: z.string().min(1).max(100),
		reason: z.string().trim().min(10).max(1000),
	})
	.strict();
export const simulateDeliveryPricingInput = z
	.object({
		terms: deliveryPricingTermsSchema,
		distanceMeters: z.number().finite().min(0).max(1_000_000),
		durationSeconds: z.number().finite().min(0).max(172_800),
	})
	.strict();

export const deliveryPriceBreakdownSchema = z.object({
	policyVersion: z.string(),
	baseCRC: amount,
	perKmCRC: amount,
	perEstimatedMinuteCRC: amount,
	distanceCRC: z.number().nonnegative(),
	estimatedDrivingCRC: z.number().nonnegative(),
	roundingCRC: z.number(),
	roadFeeCRC: z.number().int().nonnegative(),
	nearbyDiscountCRC: z.literal(0),
	readyDiscountCRC: z.literal(0),
	topUpCRC: z.literal(0),
	customerFeeCRC: z.number().int().nonnegative(),
	courierPayoutCRC: z.number().int().nonnegative(),
	fundingSource: z.enum(["CUSTOMER", "MERCHANT"]),
	fundedCRC: z.number().int().nonnegative(),
});
export type DeliveryPriceBreakdown = z.infer<
	typeof deliveryPriceBreakdownSchema
>;

export const deliveryPricingPolicySchema = z.object({
	id: z.string(),
	marketCode: z.literal("CR"),
	version: z.string(),
	previousVersion: z.string(),
	revision: z.number().int().nonnegative(),
	status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]),
	terms: deliveryPricingTermsSchema,
	createdByAdminId: z.string(),
	approvedReason: z.string(),
	createdAt: z.date(),
	activeFrom: z.date(),
});
export const deliveryPricingAdminSchema = z.object({
	active: z.object({ version: z.string(), terms: deliveryPricingTermsSchema }),
	headVersion: z.string(),
	canManage: z.boolean(),
	rows: z.array(deliveryPricingPolicySchema),
});
export const deliveryPricingSimulationSchema =
	deliveryPriceBreakdownSchema.extend({ exceedsCap: z.boolean() });

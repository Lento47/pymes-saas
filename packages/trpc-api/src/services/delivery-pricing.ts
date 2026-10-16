import {
	DEFAULT_DELIVERY_PRICING_TERMS,
	type DeliveryPriceBreakdown,
	type DeliveryPricingTerms,
} from "@pymeshub/shared";

/** This app stores CRC as whole colones; see @pymeshub/shared/money. */
export const EXPRESS_V1 = {
	version: "express-v1",
	baseMinor: DEFAULT_DELIVERY_PRICING_TERMS.baseCRC,
	perKmMinor: DEFAULT_DELIVERY_PRICING_TERMS.perKmCRC,
	perMinuteMinor: DEFAULT_DELIVERY_PRICING_TERMS.perEstimatedMinuteCRC,
	nearbyPct: DEFAULT_DELIVERY_PRICING_TERMS.nearbyMaxPct,
	readyPct: DEFAULT_DELIVERY_PRICING_TERMS.readyMaxPct,
	maxDiscountPct: DEFAULT_DELIVERY_PRICING_TERMS.combinedMaxPct,
	maxTopUpMinor: DEFAULT_DELIVERY_PRICING_TERMS.maxTopUpCRC,
	finalPriceCapMinor: DEFAULT_DELIVERY_PRICING_TERMS.customerPriceCapCRC,
} as const;

/** Round once, after both road-distance and driving-time components are added. */
export function routeFeeMinor(
	distanceMeters: number,
	durationSeconds: number,
	terms: DeliveryPricingTerms = DEFAULT_DELIVERY_PRICING_TERMS,
): number {
	if (
		!Number.isFinite(distanceMeters) ||
		distanceMeters < 0 ||
		!Number.isFinite(durationSeconds) ||
		durationSeconds < 0
	)
		throw new RangeError("Invalid road route metrics");
	const fee =
		terms.baseCRC +
		Math.round(
			(distanceMeters * terms.perKmCRC) / 1_000 +
				(durationSeconds * terms.perEstimatedMinuteCRC) / 60,
		);
	if (!Number.isSafeInteger(fee)) throw new RangeError("Delivery fee overflow");
	return fee;
}

/** Only estimated road-driving time enters the quote; elapsed tracking time never does. */
export function priceBreakdown(input: {
	policyVersion: string;
	terms: DeliveryPricingTerms;
	distanceMeters: number;
	durationSeconds: number;
	merchantCoversDelivery: boolean;
}): DeliveryPriceBreakdown {
	const roadFeeCRC = routeFeeMinor(
		input.distanceMeters,
		input.durationSeconds,
		input.terms,
	);
	const distanceCRC = (input.distanceMeters * input.terms.perKmCRC) / 1000;
	const estimatedDrivingCRC =
		(input.durationSeconds * input.terms.perEstimatedMinuteCRC) / 60;
	return {
		policyVersion: input.policyVersion,
		baseCRC: input.terms.baseCRC,
		perKmCRC: input.terms.perKmCRC,
		perEstimatedMinuteCRC: input.terms.perEstimatedMinuteCRC,
		distanceCRC,
		estimatedDrivingCRC,
		roundingCRC:
			roadFeeCRC - input.terms.baseCRC - distanceCRC - estimatedDrivingCRC,
		roadFeeCRC,
		nearbyDiscountCRC: 0,
		readyDiscountCRC: 0,
		topUpCRC: 0,
		customerFeeCRC: input.merchantCoversDelivery ? 0 : roadFeeCRC,
		courierPayoutCRC: roadFeeCRC,
		fundingSource: input.merchantCoversDelivery ? "MERCHANT" : "CUSTOMER",
		fundedCRC: input.merchantCoversDelivery ? roadFeeCRC : 0,
	};
}

/**
 * Operational discounts stay disabled until a real courier payout and contribution
 * margin are available. A false ready signal must never be inferred at checkout.
 */
export function operationalDiscountMinor(input: {
	feeMinor: number;
	nearbyCourierEligible: boolean;
	orderAlreadyReady: boolean;
	availableMarginMinor: number;
}): number {
	if (
		!Number.isSafeInteger(input.feeMinor) ||
		input.feeMinor < 0 ||
		!Number.isSafeInteger(input.availableMarginMinor) ||
		input.availableMarginMinor < 0
	)
		throw new RangeError("Invalid delivery margin");
	const percentage = Math.min(
		EXPRESS_V1.maxDiscountPct,
		(input.nearbyCourierEligible ? EXPRESS_V1.nearbyPct : 0) +
			(input.nearbyCourierEligible && input.orderAlreadyReady
				? EXPRESS_V1.readyPct
				: 0),
	);
	return Math.min(
		Math.round((input.feeMinor * percentage) / 100),
		input.availableMarginMinor,
	);
}

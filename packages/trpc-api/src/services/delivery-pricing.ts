/** CRC amounts are stored in minor units (one colón is 100 minor units). */
export const EXPRESS_V1 = {
	version: "express-v1",
	baseMinor: 85_000,
	perKmMinor: 23_000,
	perMinuteMinor: 4_500,
	nearbyPct: 10,
	readyPct: 5,
	maxDiscountPct: 15,
	maxTopUpMinor: 0,
	finalPriceCapMinor: null as number | null,
} as const;

/** Round once, after both road-distance and driving-time components are added. */
export function routeFeeMinor(
	distanceMeters: number,
	durationSeconds: number,
): number {
	if (
		!Number.isFinite(distanceMeters) ||
		distanceMeters < 0 ||
		!Number.isFinite(durationSeconds) ||
		durationSeconds < 0
	)
		throw new RangeError("Invalid road route metrics");
	const fee =
		EXPRESS_V1.baseMinor +
		Math.round(
			(distanceMeters * EXPRESS_V1.perKmMinor) / 1_000 +
				(durationSeconds * EXPRESS_V1.perMinuteMinor) / 60,
		);
	if (!Number.isSafeInteger(fee)) throw new RangeError("Delivery fee overflow");
	return fee;
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

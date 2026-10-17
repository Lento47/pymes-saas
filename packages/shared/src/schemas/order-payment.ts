import { z } from "zod";
import { currencySchema } from "./common";
import { MAX_UPLOAD_BASE64_CHARS, UPLOAD_MIME_TYPES } from "./upload";

export const sinpeAccountInput = z
	.object({
		phone: z
			.string()
			.trim()
			.regex(/^(?:\+506)?\d{8}$/)
			.transform((phone) => (phone.startsWith("+") ? phone : `+506${phone}`)),
		recipientName: z.string().trim().min(2).max(120),
	})
	.strict();
/** Receipt bytes remain private and are uploaded before any order is created. */
export const checkoutPaymentAccountSchema = z.object({ businessId: z.string().nullable(), account: sinpeAccountInput.nullable() });
export const checkoutPaymentProofInput = z.object({
	businessId: z.string().min(1), amountMinor: z.number().int().positive(),
	account: sinpeAccountInput,
	mimeType: z.enum(UPLOAD_MIME_TYPES), base64: z.string().min(1).max(MAX_UPLOAD_BASE64_CHARS),
	reference: z.string().trim().max(120).optional(),
}).strict();
export const checkoutPaymentProofRefSchema = z.object({ proofId: z.string().regex(/^payproof_[0-9a-f-]{36}$/) });
export const PAYMENT_PURPOSES = [
	"MERCHANT_ORDER",
	"COURIER_COLLECTION",
	"MERCHANT_DELIVERY",
] as const;
export const paymentAccountTarget = z
	.object({ businessId: z.string().optional() })
	.strict();
export const savePaymentAccountInput = paymentAccountTarget
	.extend({ account: sinpeAccountInput.nullable() })
	.strict();
export const paymentAccountSchema = z.object({
	canEdit: z.boolean(),
	account: sinpeAccountInput.nullable(),
});
export const PAYMENT_REVIEW_STATES = [
	"AWAITING_PAYMENT",
	"AWAITING_VERIFICATION",
	"CONFIRMED",
	"REJECTED",
	"NOT_REQUIRED",
] as const;
export const paymentPurposeSchema = z.enum(PAYMENT_PURPOSES);
const paymentTarget = z.object({
	orderId: z.string().startsWith("ord_"),
	purpose: paymentPurposeSchema,
});
export const submitPaymentProofInput = paymentTarget
	.extend({
		mimeType: z.enum(UPLOAD_MIME_TYPES),
		base64: z.string().min(1).max(MAX_UPLOAD_BASE64_CHARS),
		reference: z.string().trim().max(120).optional(),
		expectedVersion: z.number().int().nonnegative(),
	})
	.strict();
export const choosePaymentMethodInput = paymentTarget
	.extend({
		method: z.enum(["CASH", "SINPE_MOVIL"]),
		expectedVersion: z.number().int().nonnegative(),
	})
	.strict();
export const reviewPaymentInput = paymentTarget
	.extend({
		decision: z.enum(["CONFIRM", "REJECT"]),
		expectedVersion: z.number().int().nonnegative(),
		proofId: z.string().optional(),
		reason: z.string().trim().max(300).optional(),
	})
	.strict();
export const orderPaymentSchema = z.object({
	id: z.string(),
	purpose: paymentPurposeSchema,
	amountMinor: z.number().int().nonnegative(),
	currency: currencySchema,
	payer: z.enum(["CUSTOMER", "COURIER", "MERCHANT"]),
	payee: z.enum(["COURIER", "MERCHANT"]),
	method: z.enum(["CASH", "SINPE_MOVIL"]),
	status: z.enum(PAYMENT_REVIEW_STATES),
	payeeName: z.string(),
	sinpePhone: z.string().nullable(),
	version: z.number().int().nonnegative(),
	proofId: z.string().nullable(),
	reference: z.string().nullable(),
	rejectionReason: z.string().nullable(),
	canPay: z.boolean(),
	canVerify: z.boolean(),
	canViewProof: z.boolean(),
	unlocked: z.boolean(),
	sinpeAvailable: z.boolean(),
	confirmedAt: z.date().nullable(),
});
export type OrderPayment = z.infer<typeof orderPaymentSchema>;
export const orderPaymentsSchema = z.object({
	orderId: z.string(),
	cashAdvance: z.boolean(),
	merchantAmountMinor: z.number().int().nonnegative(),
	courierChargeMinor: z.number().int().nonnegative(),
	customerTotalMinor: z.number().int().nonnegative(),
	courierEarningsMinor: z.number().int().nonnegative(),
	currency: currencySchema,
	legacy: z.boolean(),
	payments: z.array(orderPaymentSchema),
});
export type OrderPayments = z.infer<typeof orderPaymentsSchema>;
export const PAYMENT_ERROR_KEYS = [
	"payments.refusal.cancelled",
	"payments.refusal.waitForMerchant",
	"payments.refusal.changed",
	"payments.refusal.methodLocked",
	"payments.refusal.noSinpe",
	"payments.refusal.image",
	"payments.refusal.proofRequired",
	"payments.refusal.reusedProof",
	"payments.refusal.reason",
	"payments.refusal.businessUnpaid",
	"payments.refusal.collectionUnpaid",
] as const;

/** Tips belong to the business in the current checkout contract. */
export function splitOrderPayment(input: {
	totalMinor: number;
	deliveryFeeMinor: number;
	fulfilment: string;
	paymentMethod: string;
}) {
	const courierChargeMinor =
		input.fulfilment === "DELIVERY" ? input.deliveryFeeMinor : 0;
	const merchantAmountMinor = input.totalMinor - courierChargeMinor;
	if (
		!Number.isSafeInteger(merchantAmountMinor) ||
		merchantAmountMinor < 0 ||
		courierChargeMinor < 0
	)
		throw new RangeError("Invalid order payment split");
	return {
		merchantAmountMinor,
		courierChargeMinor,
		cashAdvance:
			input.fulfilment === "DELIVERY" && input.paymentMethod === "CASH",
	};
}

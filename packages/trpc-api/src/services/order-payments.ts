import {
	paymentAccount as account,
	courierProfile,
	delivery,
	order,
	orderPayment as payment,
	orderPaymentProof as proof,
} from "@pymeshub/db";
import {
	type choosePaymentMethodInput,
	MAX_UPLOAD_BYTES,
	type OrderPayment,
	type OrderPayments,
	type reviewPaymentInput,
	type savePaymentAccountInput,
	splitOrderPayment,
	type submitPaymentProofInput,
} from "@pymeshub/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { z } from "zod";
import { rateLimit } from "../context";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../errors";
import { auditStatement } from "./audit";
import type { UserContext } from "./helpers";
import { batchOf } from "./helpers";

type OrderRow = typeof order.$inferSelect;
type PaymentOrder = OrderRow & { paymentCourierId: string | null };
type PaymentRow = typeof payment.$inferSelect;
type AccountRow = typeof account.$inferSelect;
const settled = (status: string) =>
	status === "CONFIRMED" || status === "NOT_REQUIRED";
const paymentId = (id: string, purpose: OrderPayment["purpose"]) =>
	`opay_${id}_${purpose}`;

function businessMember(ctx: UserContext, businessId: string) {
	return ctx.memberships.find(
		(entry) => entry.businessId === businessId && entry.role !== "COURIER",
	);
}
async function scopedOrder(ctx: UserContext, orderId: string) {
	const [record] = await ctx.db
		.select({ row: order, driverId: delivery.courierUserId })
		.from(order)
		.leftJoin(delivery, eq(delivery.orderId, order.id))
		.where(eq(order.id, orderId))
		.limit(1);
	const row = record?.row;
	if (
		!row ||
		!(
			row.customerId === ctx.user.id ||
			record.driverId === ctx.user.id ||
			row.selfDeliveryUserId === ctx.user.id ||
			businessMember(ctx, row.businessId) ||
			ctx.user.isAdmin
		)
	)
		throw new NotFoundError();
	return {
		...row,
		paymentCourierId: record.driverId ?? row.selfDeliveryUserId,
	};
}
function active(row: OrderRow) {
	if (["CANCELLED", "REJECTED"].includes(row.status))
		throw new ConflictError("payments.refusal.cancelled");
}
async function accountFor(
	ctx: UserContext,
	target: { businessId?: string; userId?: string },
) {
	const [row] = await ctx.db
		.select()
		.from(account)
		.where(
			target.businessId
				? eq(account.businessId, target.businessId)
				: eq(account.userId, target.userId ?? ctx.user.id),
		)
		.limit(1);
	return row ?? null;
}
export async function paymentAccount(
	ctx: UserContext,
	target: { businessId?: string },
) {
	const member = target.businessId
		? businessMember(ctx, target.businessId)
		: null;
	if (target.businessId && !member) throw new NotFoundError();
	const row = await accountFor(ctx, target);
	return {
		canEdit:
			!target.businessId ||
			member?.role === "OWNER" ||
			member?.role === "MANAGER",
		account: row
			? { phone: row.phone, recipientName: row.recipientName }
			: null,
	};
}
export async function savePaymentAccount(
	ctx: UserContext,
	input: z.infer<typeof savePaymentAccountInput>,
) {
	await ctx.db.batch(batchOf(await paymentAccountStatements(ctx, input)));
	return paymentAccount(ctx, input);
}

/** Shared preparation lets business contact and SINPE changes commit in one D1 batch. */
export async function paymentAccountStatements(
	ctx: UserContext,
	input: z.infer<typeof savePaymentAccountInput>,
): Promise<BatchItem<"sqlite">[]> {
	const current = await paymentAccount(ctx, input);
	if (!current.canEdit) throw new ForbiddenError();
	const id = input.businessId
		? `payacct_business_${input.businessId}`
		: `payacct_user_${ctx.user.id}`;
	const now = new Date();
	return [
		input.account
			? ctx.db
					.insert(account)
					.values({
						id,
						businessId: input.businessId ?? null,
						userId: input.businessId ? null : ctx.user.id,
						...input.account,
						updatedAt: now,
					})
					.onConflictDoUpdate({
						target: account.id,
						set: { ...input.account, updatedAt: now },
					})
			: ctx.db.delete(account).where(eq(account.id, id)),
		auditStatement(ctx, {
			action: "payment.account",
			targetType: "payment_account",
			targetId: id,
			before: current.account,
			after: input.account,
			reason: null,
			now,
		}),
	];
}

/** One immutable set of obligations. A cash advance is reimbursed inside the customer's collection. */
export function paymentRows(input: {
	orderId: string;
	customerId: string;
	businessName: string;
	businessAccount: AccountRow | null;
	totalMinor: number;
	deliveryFeeMinor: number;
	courierFeeMinor: number | null;
	fulfilment: string;
	paymentMethod: string;
	currency: typeof order.$inferSelect.currency;
	now: Date;
}): PaymentRow[] {
	const split = splitOrderPayment(input);
	const rows: {
		purpose: OrderPayment["purpose"];
		amount: number;
		payer: OrderPayment["payer"];
		payee: OrderPayment["payee"];
		method: "CASH" | "SINPE_MOVIL";
	}[] = [
		{
			purpose: "MERCHANT_ORDER",
			amount: split.merchantAmountMinor,
			payer: split.cashAdvance ? "COURIER" : "CUSTOMER",
			payee: "MERCHANT",
			method: input.paymentMethod === "SINPE_MOVIL" ? "SINPE_MOVIL" : "CASH",
		},
		{
			purpose: "COURIER_COLLECTION",
			amount: split.cashAdvance ? input.totalMinor : split.courierChargeMinor,
			payer: "CUSTOMER",
			payee: "COURIER",
			method: "CASH",
		},
		{
			purpose: "MERCHANT_DELIVERY",
			amount:
				input.fulfilment === "DELIVERY"
					? Math.max(
							0,
							(input.courierFeeMinor ?? split.courierChargeMinor) -
								split.courierChargeMinor,
						)
					: 0,
			payer: "MERCHANT",
			payee: "COURIER",
			method: "CASH",
		},
	];
	return rows.map((row) => ({
		id: paymentId(input.orderId, row.purpose),
		orderId: input.orderId,
		purpose: row.purpose,
		amountMinor: row.amount,
		currency: input.currency,
		payer: row.payer,
		payee: row.payee,
		method: row.method,
		status: row.amount === 0 ? "NOT_REQUIRED" : "AWAITING_PAYMENT",
		payeeName:
			row.payee === "MERCHANT"
				? (input.businessAccount?.recipientName ?? input.businessName)
				: "",
		sinpePhone:
			row.payee === "MERCHANT" ? (input.businessAccount?.phone ?? null) : null,
		currentProofId: null,
		rejectionReason: null,
		version: 0,
		confirmedAt: null,
		reviewedByUserId: null,
		createdAt: input.now,
		updatedAt: input.now,
	}));
}
export async function merchantAccountForCheckout(
	ctx: UserContext,
	businessId: string,
) {
	return accountFor(ctx, { businessId });
}

function permission(ctx: UserContext, row: PaymentOrder, pay: PaymentRow) {
	const merchant = Boolean(businessMember(ctx, row.businessId));
	const driverId = row.paymentCourierId;
	const payer =
		pay.payer === "CUSTOMER"
			? row.customerId === ctx.user.id
			: pay.payer === "COURIER"
				? driverId === ctx.user.id
				: merchant;
	const recipient =
		pay.payee === "MERCHANT" ? merchant : driverId === ctx.user.id;
	return { payer, recipient };
}
function unlocked(row: PaymentOrder, pay: PaymentRow, rows: PaymentRow[]) {
	if (pay.purpose === "MERCHANT_ORDER")
		return pay.payer !== "COURIER" || Boolean(row.paymentCourierId);
	return (
		Boolean(row.paymentCourierId) &&
		Boolean(
			rows.find(
				(entry) => entry.purpose === "MERCHANT_ORDER" && settled(entry.status),
			),
		)
	);
}
export async function payments(
	ctx: UserContext,
	input: { orderId: string },
): Promise<OrderPayments> {
	const row = await scopedOrder(ctx, input.orderId);
	const split = splitOrderPayment(row);
	const rows = await ctx.db
		.select()
		.from(payment)
		.where(eq(payment.orderId, row.id));
	const driverId = row.paymentCourierId;
	const [merchantAccount, courierAccount] = await Promise.all([
		accountFor(ctx, { businessId: row.businessId }),
		driverId ? accountFor(ctx, { userId: driverId }) : Promise.resolve(null),
	]);
	const [courier] = row.courierUserId
		? await ctx.db
				.select({ name: courierProfile.displayName })
				.from(courierProfile)
				.where(eq(courierProfile.userId, row.courierUserId))
				.limit(1)
		: [];
	const proofs = rows.some((entry) => entry.currentProofId)
		? await ctx.db
				.select({ id: proof.id, reference: proof.reference })
				.from(proof)
				.where(
					inArray(
						proof.paymentId,
						rows.map((entry) => entry.id),
					),
				)
		: [];
	return {
		orderId: row.id,
		...split,
		customerTotalMinor: row.totalMinor,
		courierEarningsMinor: row.courierFeeMinor ?? split.courierChargeMinor,
		currency: row.currency,
		legacy: row.paymentFlowVersion === 0,
		payments: rows.map((pay) => {
			const access = permission(ctx, row, pay);
			const open = !["CANCELLED", "REJECTED"].includes(row.status);
			return {
				id: pay.id,
				purpose: pay.purpose,
				amountMinor: pay.amountMinor,
				currency: pay.currency,
				payer: pay.payer,
				payee: pay.payee,
				method: pay.method,
				status: pay.status,
				payeeName: pay.payeeName || courier?.name || row.courierName || "",
				sinpePhone: pay.sinpePhone,
				version: pay.version,
				proofId: pay.currentProofId,
				reference:
					proofs.find((entry) => entry.id === pay.currentProofId)?.reference ??
					null,
				rejectionReason: pay.rejectionReason,
				confirmedAt: pay.confirmedAt,
				unlocked: unlocked(row, pay, rows),
				canPay: access.payer && open && !settled(pay.status),
				canVerify: access.recipient && open && !settled(pay.status),
				canViewProof:
					Boolean(pay.currentProofId) &&
					(access.payer || access.recipient || ctx.user.isAdmin),
				sinpeAvailable: Boolean(
					pay.sinpePhone ||
						(pay.payee === "MERCHANT" ? merchantAccount : courierAccount),
				),
			};
		}),
	};
}
async function payable(
	ctx: UserContext,
	input: { orderId: string; purpose: OrderPayment["purpose"] },
) {
	const row = await scopedOrder(ctx, input.orderId);
	active(row);
	const rows = await ctx.db
		.select()
		.from(payment)
		.where(eq(payment.orderId, row.id));
	const pay = rows.find((entry) => entry.purpose === input.purpose);
	if (!pay) throw new NotFoundError();
	if (!unlocked(row, pay, rows))
		throw new ConflictError("payments.refusal.waitForMerchant");
	return { row, pay, access: permission(ctx, row, pay) };
}
function checkVersion(pay: PaymentRow, expected: number) {
	if (pay.version !== expected)
		throw new ConflictError("payments.refusal.changed");
}
function operationAudit(
	ctx: UserContext,
	pay: PaymentRow,
	action:
		| "payment.submit"
		| "payment.confirm"
		| "payment.reject"
		| "payment.method",
	after: unknown,
	reason: string | null,
	now: Date,
) {
	return auditStatement(ctx, {
		id: `payment:${pay.id}:${pay.version}`,
		action,
		targetType: "order_payment",
		targetId: pay.id,
		before: {
			status: pay.status,
			method: pay.method,
			proofId: pay.currentProofId,
			amountMinor: pay.amountMinor,
		},
		after,
		reason,
		now,
	});
}
async function commit(
	ctx: UserContext,
	pay: PaymentRow,
	updates: Partial<typeof payment.$inferInsert>,
	action: Parameters<typeof operationAudit>[2],
	reason: string | null,
	extra: BatchItem<"sqlite">[] = [],
) {
	const now = new Date();
	try {
		await ctx.db.batch(
			batchOf([
				...extra,
				ctx.db
					.update(payment)
					.set({ ...updates, version: pay.version + 1, updatedAt: now })
					.where(and(eq(payment.id, pay.id), eq(payment.version, pay.version))),
				operationAudit(ctx, pay, action, updates, reason, now),
				ctx.db
					.update(order)
					.set({
						merchantPaymentConfirmed: sql`exists(select 1 from order_payment p where p.order_id=${pay.orderId} and p.purpose='MERCHANT_ORDER' and p.status in ('CONFIRMED','NOT_REQUIRED'))`,
						paymentStatus: sql`case when not exists(select 1 from order_payment p where p.order_id=${pay.orderId} and p.purpose!='MERCHANT_DELIVERY' and p.status not in ('CONFIRMED','NOT_REQUIRED')) then 'PAID' when exists(select 1 from order_payment p where p.order_id=${pay.orderId} and p.status='AWAITING_VERIFICATION') then 'PENDING' else 'UNPAID' end`,
						updatedAt: now,
					})
					.where(eq(order.id, pay.orderId)),
			]),
		);
	} catch (error) {
		const [owner] = await ctx.db
			.select({ status: order.status })
			.from(order)
			.where(eq(order.id, pay.orderId))
			.limit(1);
		if (owner && ["CANCELLED", "REJECTED"].includes(owner.status))
			throw new ConflictError("payments.refusal.cancelled");
		const [current] = await ctx.db
			.select({ version: payment.version })
			.from(payment)
			.where(eq(payment.id, pay.id))
			.limit(1);
		if (current?.version !== pay.version)
			throw new ConflictError("payments.refusal.changed");
		throw error;
	}
}

export async function chooseMethod(
	ctx: UserContext,
	input: z.infer<typeof choosePaymentMethodInput>,
) {
	const { row, pay, access } = await payable(ctx, input);
	if (!access.payer) throw new ForbiddenError();
	checkVersion(pay, input.expectedVersion);
	if (settled(pay.status) || pay.status === "AWAITING_VERIFICATION")
		throw new ConflictError("payments.refusal.changed");
	if (
		pay.purpose === "MERCHANT_ORDER" &&
		!splitOrderPayment(row).cashAdvance &&
		input.method !== row.paymentMethod
	)
		throw new ValidationError("payments.refusal.methodLocked");
	const target =
		pay.payee === "MERCHANT"
			? { businessId: row.businessId }
			: { userId: row.paymentCourierId ?? "" };
	const destination =
		input.method === "SINPE_MOVIL" ? await accountFor(ctx, target) : null;
	if (input.method === "SINPE_MOVIL" && !destination)
		throw new ValidationError("payments.refusal.noSinpe");
	await commit(
		ctx,
		pay,
		{
			method: input.method,
			currentProofId: null,
			rejectionReason: null,
			status: "AWAITING_PAYMENT",
			...(destination
				? {
						sinpePhone: destination.phone,
						payeeName: destination.recipientName,
					}
				: {}),
		},
		"payment.method",
		null,
	);
	return payments(ctx, input);
}

function imageBytes(base64: string, mimeType: string) {
	let bytes: Uint8Array;
	try {
		bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	} catch {
		throw new ValidationError("payments.refusal.image");
	}
	const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
		(byte, i) => bytes[i] === byte,
	);
	const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	const webp =
		new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
		new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
	if (
		bytes.length === 0 ||
		bytes.length > MAX_UPLOAD_BYTES ||
		!(
			(mimeType === "image/png" && png) ||
			(mimeType === "image/jpeg" && jpeg) ||
			(mimeType === "image/webp" && webp)
		)
	)
		throw new ValidationError("payments.refusal.image");
	return bytes;
}
export async function submitProof(
	ctx: UserContext,
	input: z.infer<typeof submitPaymentProofInput>,
) {
	const { pay, access } = await payable(ctx, input);
	if (!access.payer) throw new ForbiddenError();
	if (pay.method !== "SINPE_MOVIL" || !pay.sinpePhone)
		throw new ValidationError("payments.refusal.noSinpe");
	const bytes = imageBytes(input.base64, input.mimeType);
	const hash = Array.from(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
		),
		(byte) => byte.toString(16).padStart(2, "0"),
	).join("");
	const [existing] = await ctx.db
		.select()
		.from(proof)
		.where(eq(proof.sha256, hash))
		.limit(1);
	if (existing) {
		if (
			existing.paymentId === pay.id &&
			existing.id === pay.currentProofId &&
			pay.status !== "REJECTED"
		)
			return payments(ctx, input);
		throw new ConflictError("payments.refusal.reusedProof");
	}
	checkVersion(pay, input.expectedVersion);
	if (settled(pay.status) || pay.status === "AWAITING_VERIFICATION")
		throw new ConflictError("payments.refusal.changed");
	await rateLimit(ctx.env, "payments:proof", ctx.user.id, 8, 60);
	const id = `payproof_${crypto.randomUUID()}`;
	const key = `private/payment-proofs/${pay.id}/${id}`;
	await ctx.env.MEDIA.put(key, bytes, {
		httpMetadata: { contentType: input.mimeType },
	});
	try {
		await commit(
			ctx,
			pay,
			{
				currentProofId: id,
				status: "AWAITING_VERIFICATION",
				rejectionReason: null,
			},
			"payment.submit",
			null,
			[
				ctx.db.insert(proof).values({
					id,
					paymentId: pay.id,
					uploaderUserId: ctx.user.id,
					key,
					mimeType: input.mimeType,
					sha256: hash,
					reference: input.reference ?? null,
					createdAt: new Date(),
				}),
			],
		);
	} catch (error) {
		// Never delete evidence if the database committed but its response was lost.
		const [stored] = await ctx.db
			.select({ id: proof.id })
			.from(proof)
			.where(eq(proof.id, id))
			.limit(1);
		if (!stored) {
			try {
				await ctx.env.MEDIA.delete(key);
			} catch {
				console.error("payment_proof_cleanup_failed", { proofId: id });
			}
		}
		const [duplicate] = await ctx.db
			.select({ id: proof.id })
			.from(proof)
			.where(eq(proof.sha256, hash))
			.limit(1);
		if (!stored && duplicate)
			throw new ConflictError("payments.refusal.reusedProof");
		throw error;
	}
	return payments(ctx, input);
}
export async function reviewPayment(
	ctx: UserContext,
	input: z.infer<typeof reviewPaymentInput>,
) {
	const { pay, access } = await payable(ctx, input);
	if (!access.recipient) throw new ForbiddenError();
	if (
		input.decision === "CONFIRM" &&
		settled(pay.status) &&
		pay.currentProofId === (input.proofId ?? null)
	)
		return payments(ctx, input);
	checkVersion(pay, input.expectedVersion);
	if (settled(pay.status)) throw new ConflictError("payments.refusal.changed");
	if (
		pay.method === "SINPE_MOVIL" &&
		(pay.status !== "AWAITING_VERIFICATION" ||
			!input.proofId ||
			input.proofId !== pay.currentProofId)
	)
		throw new ConflictError("payments.refusal.changed");
	if (
		input.decision === "REJECT" &&
		(!input.reason?.trim() || pay.method !== "SINPE_MOVIL")
	)
		throw new ValidationError("payments.refusal.reason");
	await commit(
		ctx,
		pay,
		{
			status: input.decision === "CONFIRM" ? "CONFIRMED" : "REJECTED",
			confirmedAt: input.decision === "CONFIRM" ? new Date() : null,
			reviewedByUserId: ctx.user.id,
			rejectionReason:
				input.decision === "REJECT" ? (input.reason ?? null) : null,
		},
		input.decision === "CONFIRM" ? "payment.confirm" : "payment.reject",
		input.reason ?? null,
	);
	return payments(ctx, input);
}
export async function paymentProof(
	ctx: UserContext,
	input: {
		orderId: string;
		purpose: OrderPayment["purpose"];
		proofId?: string;
	},
) {
	const row = await scopedOrder(ctx, input.orderId);
	const [pay] = await ctx.db
		.select()
		.from(payment)
		.where(and(eq(payment.orderId, row.id), eq(payment.purpose, input.purpose)))
		.limit(1);
	if (!pay?.currentProofId) throw new NotFoundError();
	if (input.proofId && input.proofId !== pay.currentProofId)
		throw new NotFoundError();
	const access = permission(ctx, row, pay);
	if (!(access.payer || access.recipient || ctx.user.isAdmin))
		throw new NotFoundError();
	const [stored] = await ctx.db
		.select()
		.from(proof)
		.where(and(eq(proof.id, pay.currentProofId), eq(proof.paymentId, pay.id)))
		.limit(1);
	const object = stored ? await ctx.env.MEDIA.get(stored.key) : null;
	if (!stored || !object) throw new NotFoundError();
	const bytes = new Uint8Array(await object.arrayBuffer());
	let binary = "";
	for (let i = 0; i < bytes.length; i += 16384)
		binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
	return { mimeType: stored.mimeType, base64: btoa(binary) };
}

export async function requirePaymentStage(
	ctx: UserContext,
	row: OrderRow,
	stage: "READY" | "PICKUP" | "COMPLETE",
) {
	if (row.paymentFlowVersion === 0) return;
	if (
		stage === "READY" &&
		(row.paymentMethod !== "SINPE_MOVIL" || row.fulfilment !== "DELIVERY")
	)
		return;
	const rows = await ctx.db
		.select()
		.from(payment)
		.where(eq(payment.orderId, row.id));
	const merchant = rows.find((entry) => entry.purpose === "MERCHANT_ORDER");
	if (!merchant || !settled(merchant.status))
		throw new ConflictError("payments.refusal.businessUnpaid");
	if (stage === "COMPLETE" && rows.some((entry) => !settled(entry.status)))
		throw new ConflictError("payments.refusal.collectionUnpaid");
}

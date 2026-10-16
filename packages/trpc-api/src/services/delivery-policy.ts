import { type Db, membership } from "@pymeshub/db";
import { effectivePlan } from "@pymeshub/shared";
import { and, eq } from "drizzle-orm";
import { loadBilling } from "../context";

/** A fixed courier agreement requires Business tier and an accepted affiliation. */
export async function canSetDeliveryFee(
	db: Db,
	businessId: string,
): Promise<boolean> {
	const billing = await loadBilling(db, businessId, new Date());
	if (effectivePlan(billing.plan, billing.status) !== "BUSINESS") return false;
	const [courier] = await db
		.select({ id: membership.id })
		.from(membership)
		.where(
			and(
				eq(membership.businessId, businessId),
				eq(membership.role, "COURIER"),
				eq(membership.status, "ACTIVE"),
			),
		)
		.limit(1);
	return Boolean(courier);
}

export async function usesExpressCalculator(
	db: Db,
	business: { id: string; deliveryPricingMode: string },
): Promise<boolean> {
	return (
		business.deliveryPricingMode !== "AFFILIATED" ||
		!(await canSetDeliveryFee(db, business.id))
	);
}

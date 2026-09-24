/**
 * The order lifecycle, in one place, because four surfaces need to agree on it:
 * the customer's tracker, the business's incoming-orders list, the admin's order
 * table, and the queue consumer that notifies all three.
 *
 * The failure this prevents is the ordinary one — a status list typed out once per
 * surface, drifting until the customer's tracker offers a step the business can
 * never reach. So the states are a union, the legal moves are a table, and every
 * surface asks `canTransition` rather than deciding for itself.
 *
 * A transition is legal only for the actor it belongs to. "Customer marks an order
 * ready" is not a permission the customer lacks; it is a state the machine does not
 * have, and expressing it that way means the API and the UI cannot disagree about
 * it.
 */

export const ORDER_STATUSES = [
	"PENDING",
	"ACCEPTED",
	"PREPARING",
	"READY",
	"OUT_FOR_DELIVERY",
	"COMPLETED",
	"CANCELLED",
	"REJECTED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILMENT_KINDS = ["PICKUP", "DELIVERY"] as const;
export type FulfilmentKind = (typeof FULFILMENT_KINDS)[number];

export const ORDER_ACTORS = [
	"CUSTOMER",
	"BUSINESS",
	"COURIER",
	"ADMIN",
	"SYSTEM",
] as const;
export type OrderActor = (typeof ORDER_ACTORS)[number];

/** Nothing may leave these, for any actor. The order is finished. */
const TERMINAL_STATUSES: readonly OrderStatus[] = [
	"COMPLETED",
	"CANCELLED",
	"REJECTED",
];

export function isTerminalStatus(status: OrderStatus): boolean {
	return TERMINAL_STATUSES.includes(status);
}

interface Transition {
	to: OrderStatus;
	by: readonly OrderActor[];
	/** A pickup is collected at the counter; only a delivery goes out the door. */
	fulfilment?: readonly FulfilmentKind[];
}

/**
 * The whole machine. Read it as "from this state, these moves exist, and only
 * these actors may make them".
 */
const TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
	// A placed order has not been agreed to by anyone yet. The business accepts or
	// refuses; the customer may still walk away, which is why CANCELLED is here and
	// why it is the customer's move rather than the business's.
	PENDING: [
		{ to: "ACCEPTED", by: ["BUSINESS", "ADMIN"] },
		{ to: "REJECTED", by: ["BUSINESS", "ADMIN"] },
		{ to: "CANCELLED", by: ["CUSTOMER", "ADMIN"] },
	],
	ACCEPTED: [
		{ to: "PREPARING", by: ["BUSINESS", "ADMIN"] },
		// Cancelling after acceptance is usually the customer's regret and sometimes
		// the business's stock; both are real, and both leave a refund to settle.
		{ to: "CANCELLED", by: ["CUSTOMER", "BUSINESS", "ADMIN"] },
	],
	PREPARING: [
		{ to: "READY", by: ["BUSINESS", "ADMIN"] },
		// Past this point the food is made and the money is spent, so the customer
		// is no longer an actor who can cancel — the business and an admin still can.
		{ to: "CANCELLED", by: ["BUSINESS", "ADMIN"] },
	],
	READY: [
		{
			to: "OUT_FOR_DELIVERY",
			by: ["BUSINESS", "COURIER", "ADMIN"],
			fulfilment: ["DELIVERY"],
		},
		{
			to: "COMPLETED",
			by: ["BUSINESS", "COURIER", "ADMIN"],
			fulfilment: ["PICKUP"],
		},
		{ to: "CANCELLED", by: ["BUSINESS", "ADMIN"] },
	],
	OUT_FOR_DELIVERY: [
		{ to: "COMPLETED", by: ["COURIER", "BUSINESS", "ADMIN"] },
		{ to: "CANCELLED", by: ["ADMIN"] },
	],
	COMPLETED: [],
	CANCELLED: [],
	REJECTED: [],
};

export interface TransitionCheck {
	from: OrderStatus;
	to: OrderStatus;
	actor: OrderActor;
	fulfilment: FulfilmentKind;
}

export function canTransition({
	from,
	to,
	actor,
	fulfilment,
}: TransitionCheck): boolean {
	const transition = TRANSITIONS[from].find((candidate) => candidate.to === to);
	if (!transition) return false;
	if (!transition.by.includes(actor)) return false;
	if (transition.fulfilment && !transition.fulfilment.includes(fulfilment)) {
		return false;
	}
	return true;
}

/** The moves a given actor can actually offer on a screen right now. */
export function nextStatuses(
	from: OrderStatus,
	actor: OrderActor,
	fulfilment: FulfilmentKind,
): OrderStatus[] {
	return TRANSITIONS[from]
		.filter((transition) => transition.by.includes(actor))
		.filter(
			(transition) =>
				!transition.fulfilment || transition.fulfilment.includes(fulfilment),
		)
		.map((transition) => transition.to);
}

/**
 * The customer's tracker, which is a subset of the machine on purpose: a customer
 * never sees REJECTED as a step they passed through, and a pickup never shows a
 * delivery leg. Returns the steps in display order with the current one marked,
 * which is what both the web tracker and the mobile one render.
 */
export interface TimelineStep {
	status: OrderStatus;
	state: "done" | "current" | "upcoming" | "skipped";
}

export function customerTimeline(
	status: OrderStatus,
	fulfilment: FulfilmentKind,
): TimelineStep[] {
	const steps: OrderStatus[] =
		fulfilment === "DELIVERY"
			? [
					"PENDING",
					"ACCEPTED",
					"PREPARING",
					"READY",
					"OUT_FOR_DELIVERY",
					"COMPLETED",
				]
			: ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];

	// A refusal is not the sixth step of a happy path. It ends the order, so the
	// timeline collapses to what actually happened.
	if (status === "REJECTED" || status === "CANCELLED") {
		return [
			{ status: "PENDING", state: "done" },
			{ status, state: "current" },
		];
	}

	const currentIndex = steps.indexOf(status);
	return steps.map((step, index) => ({
		status: step,
		state:
			index < currentIndex
				? "done"
				: index === currentIndex
					? "current"
					: "upcoming",
	}));
}

/**
 * Payment is a separate axis from fulfilment, and deliberately so: cash on
 * delivery means an order that is COMPLETED and PAID at the same instant, while a
 * SINPE transfer is often PAID before the business has even accepted. Modelling
 * payment as a status of the order would have made one of those two states
 * unrepresentable.
 */
export const PAYMENT_METHODS = ["CASH", "SINPE_MOVIL", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * CARD is in the union and not in this list. The brief scopes cards to "later" and
 * says no external services yet, so a card order must be refused by the API rather
 * than accepted and then fail somewhere a customer can see it.
 */
export const ENABLED_PAYMENT_METHODS: readonly PaymentMethod[] = [
	"CASH",
	"SINPE_MOVIL",
];

export function isPaymentMethodEnabled(method: PaymentMethod): boolean {
	return ENABLED_PAYMENT_METHODS.includes(method);
}

export const PAYMENT_STATUSES = [
	"UNPAID",
	"PENDING",
	"PAID",
	"REFUNDED",
	"FAILED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * Whether an order still owes money. Used by the business's order list to decide
 * whether "Complete" needs a "collect ₡…" prompt in front of it.
 */
export function requiresCollection(paymentStatus: PaymentStatus): boolean {
	return paymentStatus === "UNPAID" || paymentStatus === "PENDING";
}

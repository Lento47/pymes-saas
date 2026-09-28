/**
 * What a merchant pays, in the words the pricing page shows.
 *
 * This file used to hold five USD tiers, five add-ons and a twelve-row comparison
 * describing a product that no longer existed. It is now a projection of the one
 * source of truth: `@pymeshub/shared`'s `plans.ts`, which is also what the Worker
 * prices from. Nothing here restates a price. A number that appears in two places
 * is a number that will be wrong in one of them, and this one was wrong three ways
 * at once — the page said $15, the PayPal table said $12, and the Worker charged
 * ₡10,000.
 *
 * The two facts that are stated rather than derived, because they are the business
 * model and not arithmetic:
 *
 * - **PymesHub takes nothing of a sale.** The consumer pays the merchant for the
 *   product and the courier for the delivery; the platform never handles that money,
 *   which is why there is no commission line here and no gateway behind it.
 * - **Collection is manual.** `services/subscription.ts:467` records a payment an
 *   operator entered against a bank reference. There is no card on file, so there is
 *   no automatic charge, and the page must not imply one — a price the reader thinks
 *   will silently bill them is a misleading advertisement even when the backend
 *   never bills them.
 */
import {
	GRACE_DAYS,
	HIDDEN_AFTER_DAYS,
	LAUNCH_PRICE_BOOK,
	PLAN_LIMITS,
	PLAN_ORDER,
	PLAN_PERIOD_DAYS,
	priceMinorFor,
	type Plan,
} from "@pymeshub/shared";

/** One way to pay. `PLAN_ORDER` already lists them cheapest first, which is the order. */
export type PricingTier = {
	plan: Plan;
	/** `WEEKLY` / `MONTHLY` rendered the way the rest of the app names a plan. */
	name: string;
	/** What the merchant pays, in colones, IVA included. */
	priceMinor: number;
	/** "semana" / "mes" — the unit the price is quoted in. */
	periodLabel: string;
	/** `PLAN_PERIOD_DAYS`, in days, restated as a renewal. */
	periodDays: number;
	description: string;
	features: string[];
	/** The countable limits, in the words the page shows rather than the column names. */
	limits: { label: string; value: string }[];
	popular: boolean;
	cta: string;
};

/**
 * Colones, whole, without the cents a merchant will never see.
 *
 * `Intl` would render "₡2.000,00" and this product charges whole colones, so the
 * fraction is noise that makes two prices look like they differ. Grouped the Costa
 * Rican way — every three digits — which is what `es-CR` does and what a reader
 * checking the figure against a bank transfer expects to see.
 */
export function formatColones(minor: number): string {
	const digits = Math.trunc(minor / 100).toString();
	const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	return `₡${grouped}`;
}

/** Storage in the units a merchant reasons in — gigabytes, not bytes. */
function gibibytes(bytes: number): string {
	return `${Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10} GB`;
}

const TIER_COPY: Record<
	Plan,
	{ name: string; periodLabel: string; description: string; cta: string; features: string[] }
> = {
	WEEKLY: {
		name: "Semanal",
		periodLabel: "semana",
		description: "Para empezar a vender esta semana, sin comprometerte a un mes.",
		cta: "Empezar con el plan semanal",
		features: [
			"Tu tienda con catálogo y delivery",
			"Retiro en tienda y pago en efectivo contra entrega",
			"Una persona con acceso a tu negocio",
			"Historial de 90 días",
		],
	},
	MONTHLY: {
		name: "Mensual",
		periodLabel: "mes",
		description: "Para un negocio que ya tiene pedidos y los quiere todos en un panel.",
		cta: "Empezar con el plan mensual",
		features: [
			"Todo lo del plan semanal",
			"Hasta 3 personas en tu equipo, con roles",
			"Control de inventario",
			"Promociones activas y dos años de historial",
		],
	},
};

export const PRICING_TIERS: PricingTier[] = PLAN_ORDER.map((plan) => {
	const limits = PLAN_LIMITS[plan];
	return {
		plan,
		name: TIER_COPY[plan].name,
		priceMinor: priceMinorFor(plan, LAUNCH_PRICE_BOOK),
		periodLabel: TIER_COPY[plan].periodLabel,
		periodDays: PLAN_PERIOD_DAYS[plan],
		description: TIER_COPY[plan].description,
		features: TIER_COPY[plan].features,
		limits: [
			{ label: "Productos", value: String(limits.products) },
			{ label: "Imágenes por producto", value: String(limits.imagesPerProduct) },
			{ label: "Personas con acceso", value: String(limits.staffAccounts) },
			{ label: "Ubicaciones", value: String(limits.locations) },
			{ label: "Promociones activas", value: String(limits.activePromotions) },
			{ label: "Almacenamiento", value: gibibytes(limits.storageBytes) },
			{
				label: "Historial disponible",
				value: limits.analyticsDays >= 365 ? "2 años" : `${limits.analyticsDays} días`,
			},
			{
				label: "Control de inventario",
				value: limits.inventoryTracking ? "Incluido" : "No incluido",
			},
		],
		popular: plan === "MONTHLY",
		cta: TIER_COPY[plan].cta,
	};
});

export type FAQ = { question: string; answer: string };

/**
 * The questions this product actually raises, in the order they are asked.
 *
 * Every entry answers something a reader cannot get from the card above it, and two
 * of them answer a question the old page left a reader with the wrong idea about:
 * whether the price is a share of their sales, and what happens if they stop paying.
 */
export const FAQS: FAQ[] = [
	{
		question: "¿Tengo que pagar un porcentaje de mis ventas?",
		answer:
			"No. PymesHub cobra una tarifa fija por el acceso a la app y no toma ningún porcentaje de lo que vendés. Tu cliente te paga a vos por el producto y al repartidor por la entrega; ese dinero nunca pasa por nosotros.",
	},
	{
		question: "¿Los precios incluyen IVA?",
		answer:
			"Sí. El precio que ves es el que pagás, IVA incluido. Nosotros lo declaramos y lo remitimos ante Hacienda.",
	},
	{
		question: "¿Cómo se paga la suscripción?",
		answer:
			"Te emitimos la factura y la pagás por transferencia bancaria, como pagás el alquiler. En estos planes no guardamos tu tarjeta y no hacemos cargos automáticos.",
	},
	{
		question: "¿Se renueva automáticamente?",
		answer:
			"No. Cada período te lo cobramos manualmente contra la factura que te emitimos. Si no pagás, no se te cobra nada de forma automática: lo que pasa está descrito abajo.",
	},
	{
		question: "¿Qué pasa si dejo de pagar?",
		answer:
			`Tienes ${GRACE_DAYS} días de cortesía para pagar antes de que perdamos acceso. Pasados esos días tu tienda sigue apareciendo en el marketplace, pero con los límites del plan semanal, para que no pierdas a tus clientes. A los ${HIDDEN_AFTER_DAYS} días la tienda se pausa y deja de aparecer. En cualquier momento podés pagar antes y recuperás todo.`,
	},
	{
		question: "¿Puedo cambiar de plan?",
		answer:
			"Sí. El semanal y el mensual son los mismos servicios con distinta duración y límites: cambiás cuando querés y el siguiente período se cobra al precio del plan nuevo.",
	},
	{
		question: "¿Suben los precios?",
		answer:
			"Pueden subir a futuro, y si lo hacen no te afectan retroactivamente: el precio se mantiene el que tenías hasta que termina tu período actual, y el aumento se aplica en la siguiente renovación. Te avisamos antes.",
	},
	{
		question: "¿Cómo recibo el dinero de mis pedidos?",
		answer:
			"Si tu cliente paga en efectivo, el dinero queda en tu caja y el pago queda registrado en el pedido. Si acepta tarjeta o transferencia, el cobro se registra por pedido y lo liquida tu proveedor de pagos.",
	},
	{
		question: "¿Quién hace las entregas?",
		answer:
			"Tu negocio mantiene su propia operación de entrega — tu gente, tus rutas. PymesHub organiza el pedido, la zona de cobertura y el estado en vivo para tu cliente.",
	},
	{
		question: "¿Puedo definir mi zona de entrega?",
		answer:
			"Sí. Cada comercio define su radio de cobertura y sus horarios. Los clientes fuera de tu zona pueden pedir retiro en tienda, pero no entrega a domicilio.",
	},
];

/**
 * The side-by-side, generated from the same `PLAN_LIMITS` the cards read.
 *
 * Generated rather than written so a limit that moves in `plans.ts` cannot leave a
 * stale row claiming something the Worker will refuse. `formatColones` is not used
 * here because the header carries the price and repeating it per column would
 * suggest the number could differ between the two.
 */
export const FEATURE_COMPARISON: { feature: string; weekly: string; monthly: string }[] = [
	{
		feature: "Precio (IVA incluido)",
		weekly: `${formatColones(priceMinorFor("WEEKLY", LAUNCH_PRICE_BOOK))} por semana`,
		monthly: `${formatColones(priceMinorFor("MONTHLY", LAUNCH_PRICE_BOOK))} por mes`,
	},
	...PRICING_TIERS[0].limits.map((limit, index) => ({
		feature: limit.label,
		weekly: PRICING_TIERS[0].limits[index].value,
		monthly: PRICING_TIERS[1].limits[index].value,
	})),
];

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
	priceMinorFor,
	type Plan,
} from "@pymeshub/shared";

/**
 * One tier, and the two ways to be invoiced for it.
 *
 * **The tier is the row and the cadence is the two prices on it**, which is the shape the
 * product now has: the plan decides what a merchant gets and the cadence decides when they
 * pay. A page that rendered one card per (tier, cadence) pair would show eight cards for four
 * shops and imply that paying yearly buys something — it does not, and the identical `limits`
 * below both prices is the page saying so.
 */
export type PricingTier = {
	plan: Plan;
	/** The tier's own name, which is the retired `apps/api` vocabulary. */
	name: string;
	/** What the merchant pays per month, in colones, IVA included. `0` on `FREE`. */
	monthlyMinor: number;
	/** The annual price, or `null` on the tier that is never charged. */
	yearlyMinor: number | null;
	/** True only on the free tier, so the page renders it as a sign-up rather than a price. */
	isFree: boolean;
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

/**
 * The tiers, named the way the retired `apps/api` catalogue named them.
 *
 * `Emprende` is a Costa Rican verb before it is a plan: it is what somebody opening a soda
 * says they are doing. `Starter` and `Growth` are the two rungs a shop climbs, and `Business`
 * is where a merchant with more than one location lands. The vocabulary is inherited so a
 * merchant who read the old price page has not met a new product here.
 */
const TIER_COPY: Record<
	Plan,
	{ name: string; description: string; cta: string; features: string[] }
> = {
	FREE: {
		name: "Gratis",
		description: "Para abrir la tienda y tomar los primeros pedidos, sin pagar nada.",
		cta: "Abrir mi tienda gratis",
		features: [
			"Tu tienda con catálogo, delivery y retiro en tienda",
			"Diez entregas express por semana",
			"Una persona con acceso a tu negocio",
			"Historial de 30 días",
		],
	},
	EMPRENDE: {
		name: "Emprende",
		description: "Para un menú que ya no cabe en el plan gratis.",
		cta: "Empezar con Emprende",
		features: [
			"Todo lo del plan gratis",
			"Hasta 60 productos y 600 MB de fotos",
			"Treinta entregas express por semana",
			"Dos personas en tu equipo e historial de 90 días",
		],
	},
	STARTER: {
		name: "Starter",
		description: "Para un negocio con pedidos todos los días y catálogo grande.",
		cta: "Empezar con Starter",
		features: [
			"Todo lo de Emprende",
			"Hasta 250 productos y control de inventario",
			"Noventa entregas express por semana",
			"Promociones activas y dos años de historial",
		],
	},
	GROWTH: {
		name: "Growth",
		description: "Para un negocio que abrió su segunda sucursal.",
		cta: "Empezar con Growth",
		features: [
			"Todo lo de Starter",
			"Hasta 600 productos y dos sucursales",
			"Quince promociones activas y tres años de historial",
			"Seis GB de fotos y cinco personas en tu equipo",
		],
	},
	BUSINESS: {
		name: "Business",
		description: "Para una operación con varias sucursales y mucho volumen.",
		cta: "Empezar con Business",
		features: [
			"Todo lo de Growth",
			"Hasta 1 000 productos y cinco sucursales",
			"Entregas express sin tope",
			"Diez GB de fotos y quince personas en tu equipo",
		],
	},
};

/** Two years, three years — the page says a span, not a day count nobody converts. */
function historyLabel(days: number): string {
	if (days >= 1095) return "3 años";
	if (days >= 730) return "2 años";
	return `${days} días`;
}

/** `Infinity` is not a number a page can print, and "sin tope" is what it means. */
function expressLabel(perWeek: number): string {
	return perWeek === Infinity ? "Sin tope" : `${perWeek} por semana`;
}

export const PRICING_TIERS: PricingTier[] = PLAN_ORDER.map((plan) => {
	const limits = PLAN_LIMITS[plan];
	const isFree = plan === "FREE";
	return {
		plan,
		name: TIER_COPY[plan].name,
		// `0` on the free tier rather than a missing price: a page that showed no number for
		// it would read as a tier whose price had not loaded.
		monthlyMinor: isFree ? 0 : priceMinorFor(plan, "MONTHLY", LAUNCH_PRICE_BOOK),
		yearlyMinor: isFree ? null : priceMinorFor(plan, "YEARLY", LAUNCH_PRICE_BOOK),
		isFree,
		description: TIER_COPY[plan].description,
		features: TIER_COPY[plan].features,
		limits: [
			{ label: "Productos", value: String(limits.products) },
			{ label: "Imágenes por producto", value: String(limits.imagesPerProduct) },
			{ label: "Personas con acceso", value: String(limits.staffAccounts) },
			{ label: "Sucursales", value: String(limits.locations) },
			{ label: "Promociones activas", value: String(limits.activePromotions) },
			{ label: "Entregas express", value: expressLabel(limits.expressPerWeek) },
			{ label: "Almacenamiento", value: gibibytes(limits.storageBytes) },
			{ label: "Historial disponible", value: historyLabel(limits.analyticsDays) },
			{
				label: "Control de inventario",
				value: limits.inventoryTracking ? "Incluido" : "No incluido",
			},
		],
		// The third tier rather than the dearest: a shop that has outgrown `Emprende` is the
		// reader this page is written for, and marking `Business` popular would be marking the
		// one almost nobody buys.
		popular: plan === "STARTER",
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
			`Tienes ${GRACE_DAYS} días de cortesía para pagar antes de que perdamos acceso. Pasados esos días tu tienda sigue apareciendo en el marketplace, pero con los límites del plan gratis, para que no pierdas a tus clientes. A los ${HIDDEN_AFTER_DAYS} días la tienda se pausa y deja de aparecer. En cualquier momento podés pagar antes y recuperás todo.`,
	},
	{
		question: "¿Puedo cambiar de plan?",
		answer:
			"Sí, y son dos decisiones separadas. Podés subir de nivel cuando quieras — los límites nuevos aplican de inmediato — y podés elegir si te facturamos cada mes o cada año. El plan anual cuesta diez meses: los dos últimos meses del año no los pagás.",
	},
	{
		question: "¿El plan gratis tiene fecha de vencimiento?",
		answer:
			"No. El plan gratis no vence y no te pedimos tarjeta para usarlo. Incluye diez entregas express por semana; cuando se te acaban, tus clientes pueden seguir pidiendo con entrega normal o retiro en tienda.",
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
export const FEATURE_COMPARISON: { feature: string; values: string[] }[] = [
	{
		feature: "Precio mensual (IVA incluido)",
		values: PRICING_TIERS.map((tier) =>
			tier.isFree ? "Gratis" : formatColones(tier.monthlyMinor),
		),
	},
	{
		// Stated as one rule rather than three discounts, which is what "ten months of the
		// monthly price" is — see `plans.ts`'s `LAUNCH_PRICE_BOOK`.
		feature: "Precio anual (IVA incluido)",
		values: PRICING_TIERS.map((tier) =>
			tier.yearlyMinor === null ? "—" : formatColones(tier.yearlyMinor),
		),
	},
	...PRICING_TIERS[0].limits.map((limit, index) => ({
		feature: limit.label,
		values: PRICING_TIERS.map((tier) => tier.limits[index]?.value ?? "—"),
	})),
];

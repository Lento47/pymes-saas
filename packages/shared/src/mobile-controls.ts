import { z } from "zod";

export type MobileRole = "customer" | "merchant" | "courier";
type Localized = { es: string; en: string };
export type MobileControl = {
	id: string;
	role: MobileRole | "all";
	screen: string;
	kind: "screen" | "section" | "tool" | "action";
	label: Localized;
	help: Localized;
	routes: readonly string[];
	parent?: string;
};

function control(
	id: string,
	role: MobileControl["role"],
	screen: string,
	kind: MobileControl["kind"],
	es: string,
	en: string,
	helpEs: string,
	helpEn: string,
	routes: string[] = [],
	parent?: string,
): MobileControl {
	return {
		id,
		role,
		screen,
		kind,
		label: { es, en },
		help: { es: helpEs, en: helpEn },
		routes,
		...(parent ? { parent } : {}),
	};
}

/** Home shortcuts are independent rollout choices; they do not change the catalogue. */
export const MOBILE_HOME_CATEGORY_CONTROLS = ([
	["comida", "Comida", "Food"],
	["supermercado", "Supermercado", "Groceries"],
	["tiendas", "Tiendas", "Shops"],
	["farmacia", "Farmacia", "Pharmacy"],
	["express", "Express", "Express"],
	["more", "Ver más categorías", "More categories"],
] as const).map(([id, es, en]) => control(
	`customer.homeCategory.${id}`, "customer", "Categorías de Inicio", "section", es, en,
	"Muestra este acceso en Inicio. Puedes habilitarlo cuando esté listo para el lanzamiento.",
	"Shows this Home shortcut. Enable it when it is ready to launch.", [], "categories",
));

/** Supported visibility only. Authentication, support and transaction completion are never switches. */
const baseControls: MobileControl[] = [
	control(
		"categories",
		"all",
		"Descubrimiento",
		"section",
		"Explorar categorías",
		"Browse categories",
		"Oculta categorías y sus enlaces; conserva productos, búsquedas y asignaciones.",
		"Hides category browsing and links; keeps products, search and assignments.",
		["categories", "category/[slug]", "category-products/[slug]"],
	),
	control(
		"campaigns",
		"customer",
		"Inicio",
		"section",
		"Campañas",
		"Campaigns",
		"Oculta las campañas de Inicio; las tiendas y productos siguen disponibles.",
		"Hides Home campaigns; shops and products remain available.",
	),
	control(
		"promotions",
		"all",
		"Promociones",
		"section",
		"Promociones",
		"Promotions",
		"Oculta el descubrimiento de descuentos; no cambia pedidos ni precios ya confirmados.",
		"Hides discount discovery; keeps existing orders and confirmed prices.",
	),
	control(
		"recommendations",
		"customer",
		"Inicio",
		"section",
		"Recomendaciones",
		"Recommendations",
		"Oculta recomendaciones; la búsqueda y las tiendas siguen disponibles.",
		"Hides recommendations; search and shops remain available.",
	),
	control(
		"announcements",
		"all",
		"Inicio",
		"section",
		"Avisos",
		"Announcements",
		"Oculta avisos editoriales; las alertas urgentes de pedidos siguen visibles.",
		"Hides editorial announcements; urgent order alerts remain visible.",
	),
	control(
		"customer.search",
		"customer",
		"Buscar",
		"screen",
		"Buscar",
		"Search",
		"Oculta la pantalla y entrada de búsqueda; conserva pedidos, pagos y seguimiento.",
		"Hides search and its navigation entry; keeps orders, payments and tracking.",
		["search"],
	),
	control(
		"customer.nearby",
		"customer",
		"Inicio",
		"screen",
		"Comercios cercanos",
		"Nearby shops",
		"Oculta la exploración por cercanía; las tiendas siguen accesibles desde sus enlaces.",
		"Hides nearby browsing; direct shop links remain available.",
		["nearby"],
	),
	control(
		"customer.featured",
		"customer",
		"Inicio",
		"screen",
		"Destacados",
		"Featured",
		"Oculta destacados; conserva búsqueda y acceso directo a tiendas.",
		"Hides featured browsing; keeps search and shop links.",
		["featured"],
	),
	control(
		"customer.offers",
		"customer",
		"Promociones",
		"screen",
		"Descuentos",
		"Discounts",
		"Oculta la pantalla de descuentos; conserva los descuentos de pedidos confirmados.",
		"Hides discount browsing; keeps discounts on confirmed orders.",
		["offers"],
		"promotions",
	),
	control(
		"customer.favorites",
		"customer",
		"Cuenta",
		"screen",
		"Favoritos",
		"Favorites",
		"Oculta favoritos sin borrar las tiendas guardadas.",
		"Hides favorites without deleting saved shops.",
		["favorites"],
	),
	control(
		"customer.cart",
		"customer",
		"Carrito",
		"screen",
		"Carrito y agregar productos",
		"Cart and adding products",
		"Pausa agregar productos y oculta el carrito; conserva su contenido y pedidos existentes.",
		"Pauses adding products and hides the cart; keeps its contents and existing orders.",
		["cart"],
	),
	control(
		"customer.newCheckout",
		"customer",
		"Pago",
		"action",
		"Nuevos pedidos",
		"New checkout",
		"Impide nuevos pedidos móviles; los pedidos, pagos y entregas existentes pueden finalizar.",
		"Stops new mobile checkout; existing orders, payments and deliveries can finish.",
		["checkout"],
	),
	control(
		"merchant.newOrders",
		"merchant",
		"Pedidos",
		"action",
		"Recibir nuevos pedidos móviles",
		"Receive new mobile orders",
		"Pausa la creación de pedidos desde la app; no bloquea atender pedidos existentes ni pedidos web.",
		"Pauses order creation from the app; keeps existing orders and web orders.",
	),
	control(
		"courier.acceptDeliveries",
		"courier",
		"Entregas",
		"action",
		"Aceptar nuevas entregas",
		"Accept new deliveries",
		"Pausa aceptar nuevos pedidos; conserva rutas, cobros y finalización de entregas aceptadas.",
		"Pauses accepting new deliveries; keeps routes, payments and completion for accepted deliveries.",
	),
	control(
		"courier.availability",
		"courier",
		"Entregas",
		"tool",
		"Activar disponibilidad",
		"Go available",
		"Pausa activar disponibilidad para nuevos pedidos; siempre permite desconectarse y finalizar entregas.",
		"Pauses going available for new deliveries; going unavailable and finishing deliveries remain possible.",
	),
];

const merchantTools = [
	["products", "Productos", "Products", "products", "product-form"],
	[
		"promotions",
		"Promociones del negocio",
		"Shop promotions",
		"promotions",
		"promotion-form",
	],
	[
		"customize",
		"Personalización",
		"Customization",
		"customize",
		"customize-dashboard",
		"customize-shop",
	],
	["hours", "Horario", "Hours", "shop-hours", "business-hours"],
	["locations", "Sucursales", "Locations", "locations"],
	[
		"settings",
		"Configuración del negocio",
		"Business settings",
		"shop-settings",
		"merchant-settings",
	],
	["profile", "Perfil del negocio", "Shop profile", "store-profile"],
	["analytics", "Estadísticas", "Analytics", "analytics"],
	["activity", "Actividad", "Activity", "activity"],
	["audit", "Historial de cambios", "Audit history", "audit-history"],
	["team", "Equipo y afiliaciones", "Team and affiliations", "team"],
	["reviews", "Reseñas", "Reviews", "reviews"],
] as const;
export const MOBILE_CONTROLS: readonly MobileControl[] = [
	...baseControls,
	...MOBILE_HOME_CATEGORY_CONTROLS,
	...merchantTools.map(([id, es, en, ...routes]) =>
		control(
			`merchant.${id}`,
			"merchant",
			es,
			"tool",
			es,
			en,
			`Oculta ${es.toLowerCase()} y sus entradas; conserva pedidos, pagos y soporte existentes.`,
			`Hides ${en.toLowerCase()} and its entries; keeps existing orders, payments and support.`,
			[...routes],
			id === "promotions" ? "promotions" : undefined,
		),
	),
	...(
		[
			["shortcuts", "Accesos rápidos", "Shortcuts"],
			["pulse", "Indicadores", "Metrics"],
			["insights", "Resumen del negocio", "Business insights"],
			["catalog", "Vista previa de productos", "Product preview"],
		] as const
	).map(([id, es, en]) =>
		control(
			`merchant.widget.${id}`,
			"merchant",
			"Inicio",
			"section",
			es,
			en,
			"Oculta este bloque incluso en paneles personalizados; conserva alertas y acciones de pedidos.",
			"Hides this block even in personalized dashboards; keeps order alerts and actions.",
		),
	),
	control(
		"merchant.guide",
		"merchant",
		"Inicio",
		"tool",
		"Guía del negocio",
		"Merchant guide",
		"Oculta la guía; soporte y configuración siguen accesibles.",
		"Hides the guide; support and configuration remain accessible.",
	),
	control(
		"courier.invitations",
		"courier",
		"Cuenta",
		"tool",
		"Invitaciones de negocios",
		"Business invitations",
		"Oculta nuevas afiliaciones; conserva entregas aceptadas y el perfil del repartidor.",
		"Hides new affiliations; keeps accepted deliveries and the courier profile.",
		["courier-invites"],
	),
	control(
		"courier.completed",
		"courier",
		"Entregas",
		"section",
		"Entregas completadas recientes",
		"Recent completed deliveries",
		"Oculta el resumen reciente; conserva entregas activas y acceso a sus detalles.",
		"Hides the recent summary; keeps active deliveries and their details.",
	),
	control(
		"customer.stores",
		"customer",
		"Comercios",
		"screen",
		"Páginas de comercios",
		"Shop pages",
		"Oculta la navegación a tiendas; los pedidos existentes mantienen sus detalles y contacto.",
		"Hides shop browsing; existing orders keep their details and contact.",
		["store/[slug]"],
	),
	control(
		"customer.products",
		"customer",
		"Productos",
		"screen",
		"Detalle de productos",
		"Product details",
		"Oculta el detalle para nuevas compras; conserva los productos de pedidos confirmados.",
		"Hides details for new purchases; keeps confirmed order items.",
		["product/[id]"],
	),
];

const controlsById = new Map(MOBILE_CONTROLS.map((item) => [item.id, item]));
/** API write boundaries. Existing payment, tracking and completion procedures are excluded. */
export const MOBILE_OPERATIONAL_ACTIONS = {
	"orders.place": ["customer.newCheckout", "merchant.newOrders"],
	"cart.addItem": ["customer.cart"],
	"orders.reorder": ["customer.cart"],
	"cart.applyPromotion": ["promotions"],
	"deliveries.acceptOffer": ["courier.acceptDeliveries"],
	"couriers.goAvailable": ["courier.availability"],
} as const;
export const MOBILE_CONFIG_FRESHNESS_MS = 60_000;

const localizedText = (max: number) =>
	z.object({
	es: z.string().trim().min(1, "Completa los textos en español e inglés.").max(max),
	en: z.string().trim().min(1, "Completa los textos en español e inglés.").max(max),
	});
export const mobileDestinationSchema = z
	.object({
		kind: z.enum([
			"home",
			"help",
			"settings",
			"inbox",
			"search",
			"offers",
			"store",
			"product",
			"merchantOrders",
			"merchantProducts",
			"merchantSettings",
			"courierDeliveries",
			"courierProfile",
		]),
		value: z
			.string()
			.trim()
			.min(1)
			.max(120)
			.regex(/^[a-zA-Z0-9_-]+$/)
			.optional(),
	})
	.refine(
		(value) =>
			!["store", "product"].includes(value.kind) || Boolean(value.value),
		{ message: "Elige una tienda o un producto existente." },
	);
export const mobileContentSchema = z
	.object({
		id: z.string().trim().min(1).max(100),
		kind: z.enum(["campaign", "announcement"]),
		roles: z
			.array(z.enum(["customer", "merchant", "courier"]))
			.min(1)
			.max(3),
		title: localizedText(100),
		body: localizedText(300),
		button: localizedText(50),
		imagePath: z
			.string()
			.regex(/^\/files\/upl_[a-zA-Z0-9_-]+$/)
			.nullable(),
		destination: mobileDestinationSchema,
		startsAt: z.string().datetime({ offset: true }).nullable(),
		endsAt: z.string().datetime({ offset: true }).nullable(),
	})
	.refine((value) => value.kind !== "campaign" || value.imagePath !== null, {
		message: "Sube una imagen para la campaña.",
	})
	.refine(
		(value) =>
			!value.startsAt ||
			!value.endsAt ||
			Date.parse(value.endsAt) > Date.parse(value.startsAt),
		{ message: "La fecha de fin debe ser posterior al inicio." },
	);

export const mobileConfigurationSchema = z.object({
	version: z.literal(1),
	// Read tolerates future control names; clients only consult registered names.
	visibility: z
		.record(z.string().min(1).max(100), z.boolean())
		.refine((items) => Object.keys(items).length <= 500),
	hiddenCategoryIds: z.array(z.string().min(1).max(120)).max(5000),
	content: z
		.array(mobileContentSchema)
		.max(100)
		.refine(
			(items) => new Set(items.map((item) => item.id)).size === items.length,
		),
});
export type MobileConfiguration = z.infer<typeof mobileConfigurationSchema>;
export type MobileContent = z.infer<typeof mobileContentSchema>;
export const DEFAULT_MOBILE_CONFIGURATION: MobileConfiguration = {
	version: 1,
	visibility: {},
	hiddenCategoryIds: [],
	content: [],
};
export const mobileDraftInput = z.object({
	expectedVersion: z.number().int().nonnegative(),
	configuration: mobileConfigurationSchema.refine(
		(config) =>
			Object.keys(config.visibility).every((id) => controlsById.has(id)),
		{ message: "La configuración contiene un control no registrado." },
	),
});
export const mobilePublishInput = z.object({
	expectedVersion: z.number().int().nonnegative(),
	reason: z.string().trim().min(5).max(500),
});
export const mobileRestoreInput = mobilePublishInput.extend({
	revisionId: z.string().min(1).max(100),
});
export const publishedMobileConfigurationSchema = z.object({
	revisionId: z.string().nullable(),
	revision: z.number().int().nonnegative(),
	publishedAt: z.string().datetime().nullable(),
	configuration: mobileConfigurationSchema,
});
export type PublishedMobileConfiguration = z.infer<
	typeof publishedMobileConfigurationSchema
>;
export const mobileAdminDraftSchema = z.object({
	version: z.number().int().nonnegative(),
	draft: mobileConfigurationSchema.nullable(),
	published: publishedMobileConfigurationSchema,
	canPublish: z.boolean(),
});
export const mobileRevisionSummarySchema = z.object({
	id: z.string(),
	revision: z.number().int().positive(),
	previousRevisionId: z.string().nullable(),
	restoredFromId: z.string().nullable(),
	reason: z.string(),
	publishedByUserId: z.string(),
	createdAt: z.date(),
});
export const mobileHistorySchema = z.object({
	items: z.array(mobileRevisionSummarySchema),
	next: z.number().int().positive().optional(),
});

export const mobilePreviewInput = z.object({
	role: z.enum(["customer", "merchant", "courier"]),
	businessId: z.string().min(1).optional(),
	courierUserId: z.string().min(1).optional(),
});
export const mobileDestinationSearchInput = z.object({ kind: z.enum(["store", "product"]), query: z.string().trim().max(80), selectedValue: z.string().max(120).optional() });
export const mobileDestinationOptionsSchema = z.array(z.object({ value: z.string(), label: z.string() }));
export const mobilePreviewSchema = z.object({
	shops: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string(), status: z.string(), currency: z.enum(["CRC", "USD"]) })),
	products: z.array(z.object({ id: z.string(), businessId: z.string(), name: z.string(), imageUrl: z.string().nullable(), priceMinor: z.number(), currency: z.enum(["CRC", "USD"]) })),
	orders: z.array(z.object({ id: z.string(), reference: z.string(), businessId: z.string(), status: z.string(), totalMinor: z.number(), currency: z.enum(["CRC", "USD"]) })),
	couriers: z.array(z.object({ userId: z.string(), displayName: z.string(), serviceArea: z.string(), isAvailable: z.boolean() })),
});

/** Defaults reproduce existing availability; preferences can only further restrict it. */
export function mobileControlEnabled(
	configuration: MobileConfiguration,
	id: string,
): boolean {
	const item = controlsById.get(id);
	if (!item) return true;
	return (
		configuration.visibility[id] !== false &&
		(!item.parent || mobileControlEnabled(configuration, item.parent))
	);
}
export function mobileCategoryVisible(
	configuration: MobileConfiguration,
	category: { id: string; parentId: string | null },
	all: readonly { id: string; parentId: string | null }[],
): boolean {
	if (!mobileControlEnabled(configuration, "categories")) return false;
	const hidden = new Set(configuration.hiddenCategoryIds);
	const visited = new Set<string>();
	let current: { id: string; parentId: string | null } | undefined = category;
	while (current) {
		if (hidden.has(current.id) || (current.parentId && hidden.has(current.parentId)) || visited.has(current.id)) return false;
		visited.add(current.id);
		current = current.parentId
			? all.find((item) => item.id === current?.parentId)
			: undefined;
	}
	return true;
}
export function activeMobileContent(
	configuration: MobileConfiguration,
	role: MobileRole,
	now = Date.now(),
): MobileContent[] {
	return configuration.content.filter(
		(item) =>
			item.roles.includes(role) &&
			mobileControlEnabled(
				configuration,
				item.kind === "campaign" ? "campaigns" : "announcements",
			) &&
			(!item.startsAt || Date.parse(item.startsAt) <= now) &&
			(!item.endsAt || Date.parse(item.endsAt) > now),
	);
}

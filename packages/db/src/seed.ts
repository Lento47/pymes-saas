/**
 * Demo data for a local D1, written as a `.sql` file rather than inserted
 * directly.
 *
 * Nothing outside a Worker can open a D1 database, so "seed the database" means
 * "produce a script and hand it to `wrangler d1 execute`". That constraint is
 * also the only thing that makes the seed reviewable: a diff of the generated SQL
 * is a diff of exactly what will land in the database.
 *
 * Three properties this file holds itself to:
 *
 * - **Reproducible.** Every id is derived from a fixed string, every timestamp is
 *   measured from a fixed anchor, and the little randomness there is comes from
 *   `mulberry32` under a fixed seed. Two runs produce byte-identical output, so a
 *   change in the data always shows up as a change in the diff.
 * - **Idempotent.** Deterministic ids plus `ON CONFLICT DO NOTHING` mean running
 *   it twice is running it once. `INSERT OR REPLACE` is deliberately *not* used:
 *   SQLite implements it as a delete and re-insert, and the order lines that
 *   reference an order are `ON DELETE RESTRICT`, so replacing an order would fail
 *   rather than refresh it.
 * - **Fictional.** This repository is MIT-licensed. Every business,
 *   person, address and phone number below is invented, and every email is on
 *   `.test` — a TLD reserved by RFC 2606 so no message can reach a human.
 *
 * It writes **two** files, and the split is a safety property rather than tidiness: `seed.sql`
 * is the data, `seed-credentials.sql` is one sign-in credential per user with a password that
 * is printed in this file. `db:seed` applies both locally; `db:seed:remote` applies `seed.sql`
 * alone, so the command that can reach a deployed database is the command that cannot create
 * an account whose password is in the source.
 *
 * Run it with `bun run db:seed` from `packages/db`; see the README for the
 * `wrangler` invocation and the `-c apps/api/wrangler.toml` it needs.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BusinessHoursEntry } from "@pymeshub/shared";
import { ID_PREFIXES } from "@pymeshub/shared/ids";
import { optionDelta, optionsHash } from "@pymeshub/shared/options";
import {
	canTransition,
	type FulfilmentKind,
	type OrderActor,
	type OrderStatus,
} from "@pymeshub/shared/order-state";
import { type Column, getTableColumns, getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

import { account, type NewAccount } from "./auth-schema";
import { encodeGeohash } from "./geo";
import {
	address,
	auditLog,
	business,
	type ChosenOption,
	cart,
	cartItem,
	category,
	favorite,
	membership,
	type NewAddress,
	type NewAuditLog,
	type NewBusiness,
	type NewCart,
	type NewCartItem,
	type NewCategory,
	type NewFavorite,
	type NewMembership,
	type NewNotification,
	type NewOrder,
	type NewOrderEvent,
	type NewOrderItem,
	type NewPayout,
	type NewProduct,
	type NewProductOption,
	type NewProductOptionGroup,
	type NewPromotion,
	type NewReview,
	type NewUser,
	notification,
	type OptionGroupKind,
	order,
	orderEvent,
	orderItem,
	payout,
	product,
	productOption,
	productOptionGroup,
	promotion,
	review,
	user,
} from "./schema";

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

/** The same seed the repo has always used for demo data. */
const RANDOM_SEED = 20260920;

/** mulberry32 — small, fast, and identical across runs. */
function makeRandom(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = makeRandom(RANDOM_SEED);

function integer(min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

/**
 * Every timestamp is an offset from this instant rather than from `Date.now()`,
 * because a seed whose output changes on every run is a seed nobody can diff —
 * and "the demo data moved" is not a change worth a review.
 */
const NOW = Date.UTC(2026, 8, 20, 15, 0, 0);

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, jitterHours = 0): Date {
	const jitter = jitterHours
		? (random() - 0.5) * jitterHours * 60 * 60 * 1000
		: 0;
	return new Date(NOW - days * DAY_MS + jitter);
}

function minutesAfter(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Ids are readable rather than random — `biz_seed_001` says what it is in a log
 * line, and a re-run writes the same row instead of a second one.
 */
function seedId(prefix: string, n: number): string {
	return `${prefix}_seed_${String(n).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

const CRC = "CRC" as const;

type OptionSpec = {
	name: string;
	priceDeltaMinor: number;
	isDefault?: boolean;
};

type GroupSpec = {
	name: string;
	kind: OptionGroupKind;
	isRequired?: boolean;
	minSelect?: number;
	maxSelect?: number;
	options: OptionSpec[];
};

type ProductSpec = {
	key: string;
	categoryKey: string;
	name: string;
	description: string;
	priceMinor: number;
	compareAtPriceMinor?: number;
	sku: string;
	isFeatured?: boolean;
	trackInventory?: boolean;
	stockQuantity?: number;
	prepTimeMinutes?: number;
	tags?: string[];
	groups?: GroupSpec[];
};

const SIZE_GROUP = (largeDelta: number): GroupSpec => ({
	name: "Tamaño",
	kind: "SINGLE",
	isRequired: true,
	maxSelect: 1,
	options: [
		{ name: "Regular", priceDeltaMinor: 0, isDefault: true },
		{ name: "Grande", priceDeltaMinor: largeDelta },
	],
});

type BusinessSpec = {
	key: string;
	slug: string;
	name: string;
	description: string;
	categoryKey: string;
	city: string;
	region: string;
	lat: number;
	lng: number;
	phone: string;
	email: string;
	status: "ACTIVE" | "SUSPENDED";
	deliveryEnabled: boolean;
	pickupEnabled: boolean;
	deliveryFeeMinor: number;
	deliveryRadiusKm: number;
	prepTimeMinutes: number;
	minOrderMinor: number;
	hours: BusinessHoursEntry[];
	isVerified: boolean;
	owner: { name: string; email: string };
	staff: { name: string; email: string; role: "MANAGER" | "STAFF" }[];
	products: ProductSpec[];
};

/**
 * A week of opening hours, in wall-clock minutes. Day 0 is Sunday, matching
 * `Date.prototype.getDay()` and the `day` field of `businessHoursEntrySchema`.
 * An override of `null` is a day the shop does not open, which is a different
 * statement from opening and closing at the same minute — hence `isClosed`.
 */
function weekHours(
	opensMinute: number,
	closesMinute: number,
	overrides: Partial<
		Record<number, { opensMinute: number; closesMinute: number } | null>
	> = {},
): BusinessHoursEntry[] {
	return [0, 1, 2, 3, 4, 5, 6].map((day) => {
		const override = overrides[day];
		if (override === null) {
			return { day, opensMinute: 0, closesMinute: 0, isClosed: true };
		}
		return {
			day,
			opensMinute: override?.opensMinute ?? opensMinute,
			closesMinute: override?.closesMinute ?? closesMinute,
			isClosed: false,
		};
	});
}

/**
 * `iconName` is an **Ionicons** name, and that is a constraint rather than a preference.
 *
 * The column is a bare string, the only client that draws it is `apps/mobile`
 * (`components/category-rail.tsx`), and that cast it straight to Ionicons' `name` prop —
 * so a name from any other set does not fall back, it renders as a **tofu box**: a `?` in
 * the chip where the glyph should be, which is what every seeded category looked like
 * until 2026-09-21. The names here were `utensils`, `soup`, `beef`, `coffee`, `croissant`
 * and `apple` — Lucide/Feather names, none of which exists in Ionicons' glyphmap. Checked
 * against `glyphmaps/Ionicons.json` rather than guessed, and the replacements verified the
 * same way.
 *
 * `apps/web` is not a reason to keep it package-neutral: its category strip draws no glyph
 * at all, and the web UI kit's own icons are Carbon components passed as JSX
 * (`packages/ui/src/components/icon.tsx`), not names from this column. So this string has
 * exactly one consumer, and it is Ionicons.
 *
 * Two names are stand-ins, because Ionicons has no glyph for a bakery or a plate of
 * casado: `basket-outline` and `fast-food-outline`. Both exist; a missing glyph is worse
 * than an approximate one, because a missing glyph reads as a broken screen.
 */
const CATEGORIES: {
	key: string;
	name: string;
	slug: string;
	iconName: string;
	parentKey: string | null;
}[] = [
	{
		key: "comida",
		name: "Comida",
		slug: "comida",
		iconName: "restaurant-outline",
		parentKey: null,
	},
	{
		key: "sodas",
		name: "Sodas",
		slug: "sodas",
		iconName: "pint-outline",
		parentKey: "comida",
	},
	{
		key: "casados",
		name: "Casados",
		slug: "casados",
		iconName: "fast-food-outline",
		parentKey: "comida",
	},
	{
		key: "cafe",
		name: "Café",
		slug: "cafe",
		iconName: "cafe-outline",
		parentKey: null,
	},
	{
		key: "panaderia",
		name: "Panadería",
		slug: "panaderia",
		iconName: "basket-outline",
		parentKey: null,
	},
	{
		key: "frutas",
		name: "Frutas y verduras",
		slug: "frutas-y-verduras",
		iconName: "nutrition-outline",
		parentKey: null,
	},
];

const BUSINESSES: BusinessSpec[] = [
	{
		key: "yunta",
		slug: "soda-la-yunta",
		name: "Soda La Yunta",
		description:
			"Comida casera de todos los días, servida en el mismo salón desde hace treinta años.",
		categoryKey: "sodas",
		city: "San José",
		region: "San José",
		lat: 9.9281,
		lng: -84.0907,
		phone: "+506 5555 0101",
		email: "hola@soda-la-yunta.test",
		status: "ACTIVE",
		deliveryEnabled: true,
		pickupEnabled: true,
		deliveryFeeMinor: 1000,
		deliveryRadiusKm: 6,
		prepTimeMinutes: 25,
		minOrderMinor: 3000,
		hours: weekHours(420, 1200, { 0: { opensMinute: 480, closesMinute: 900 } }),
		isVerified: true,
		owner: { name: "Ana Solís Vega", email: "ana.solis@pymeshub.test" },
		staff: [
			{
				name: "Bruno Quesada Rojas",
				email: "bruno.quesada@pymeshub.test",
				role: "MANAGER",
			},
			{
				name: "Carla Méndez Arias",
				email: "carla.mendez@pymeshub.test",
				role: "STAFF",
			},
		],
		products: [
			{
				key: "casado-pollo",
				categoryKey: "casados",
				name: "Casado con pollo",
				description:
					"Arroz, frijoles, ensalada, plátano maduro y pollo a la plancha.",
				priceMinor: 5500,
				sku: "YUN-001",
				isFeatured: true,
				trackInventory: false,
				prepTimeMinutes: 20,
				tags: ["almuerzo", "casero"],
				groups: [
					SIZE_GROUP(900),
					{
						name: "Acompañamientos",
						kind: "MULTI",
						minSelect: 0,
						maxSelect: 2,
						options: [
							{ name: "Ensalada extra", priceDeltaMinor: 450 },
							{ name: "Plátano maduro extra", priceDeltaMinor: 500 },
							{ name: "Tortilla palmeada", priceDeltaMinor: 300 },
						],
					},
				],
			},
			{
				key: "casado-carne",
				categoryKey: "casados",
				name: "Casado con carne en salsa",
				description:
					"Carne de res en salsa criolla, con los acompañamientos de siempre.",
				priceMinor: 6200,
				sku: "YUN-002",
				trackInventory: false,
				prepTimeMinutes: 25,
				tags: ["almuerzo"],
				groups: [SIZE_GROUP(900)],
			},
			{
				key: "gallo-pinto",
				categoryKey: "casados",
				name: "Gallo pinto completo",
				description:
					"Arroz y frijoles negros, con lo que usted le quiera poner.",
				priceMinor: 2800,
				sku: "YUN-003",
				isFeatured: true,
				trackInventory: false,
				prepTimeMinutes: 12,
				tags: ["desayuno", "casero"],
				groups: [
					{
						name: "Acompañamiento",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Huevo", priceDeltaMinor: 600, isDefault: true },
							{ name: "Queso fresco", priceDeltaMinor: 700 },
							{ name: "Natilla", priceDeltaMinor: 500 },
							{ name: "Solo", priceDeltaMinor: 0 },
						],
					},
					{
						name: "Bebida",
						kind: "SINGLE",
						maxSelect: 1,
						options: [
							{ name: "Café chorreado", priceDeltaMinor: 900 },
							{ name: "Agua dulce", priceDeltaMinor: 800 },
							{ name: "Sin bebida", priceDeltaMinor: 0, isDefault: true },
						],
					},
				],
			},
			{
				key: "olla-carne",
				categoryKey: "casados",
				name: "Olla de carne",
				description: "Solo los sábados, y se acaba temprano.",
				priceMinor: 6500,
				sku: "YUN-004",
				trackInventory: true,
				stockQuantity: 24,
				prepTimeMinutes: 30,
				tags: ["sábado", "sopa"],
			},
			{
				key: "empanada",
				categoryKey: "sodas",
				name: "Empanada de queso",
				description: "Frita al momento, con la salsa aparte.",
				priceMinor: 1800,
				sku: "YUN-005",
				trackInventory: false,
				prepTimeMinutes: 10,
				groups: [
					{
						name: "Salsas",
						kind: "MULTI",
						minSelect: 0,
						maxSelect: 2,
						options: [
							{ name: "Chile dulce", priceDeltaMinor: 0, isDefault: true },
							{ name: "Tomate", priceDeltaMinor: 250 },
							{ name: "Mayonesa", priceDeltaMinor: 250 },
						],
					},
				],
			},
			{
				key: "cafe-chorreado",
				categoryKey: "sodas",
				name: "Café chorreado",
				description: "Café de Tarrazú, colado en bolsa de tela.",
				priceMinor: 1200,
				sku: "YUN-006",
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Tamaño",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "8 oz", priceDeltaMinor: 0, isDefault: true },
							{ name: "12 oz", priceDeltaMinor: 400 },
						],
					},
				],
			},
			{
				key: "agua-dulce",
				categoryKey: "sodas",
				name: "Agua dulce",
				description: "Con canela y bastante dulce, como debe ser.",
				priceMinor: 1000,
				sku: "YUN-007",
				prepTimeMinutes: 5,
			},
			{
				key: "tres-leches",
				categoryKey: "sodas",
				name: "Tres leches",
				description: "Porción generosa, con canela encima.",
				priceMinor: 2500,
				compareAtPriceMinor: 3000,
				sku: "YUN-008",
				isFeatured: true,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Porción",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Individual", priceDeltaMinor: 0, isDefault: true },
							{ name: "Doble", priceDeltaMinor: 1800 },
						],
					},
				],
			},
		],
	},
	{
		key: "mirador",
		slug: "cafe-el-mirador",
		name: "Café El Mirador",
		description:
			"Tostado propio y vista al valle. El capuchino es la razón por la que la gente vuelve.",
		categoryKey: "cafe",
		city: "Escazú",
		region: "San José",
		lat: 9.9189,
		lng: -84.14,
		phone: "+506 5555 0102",
		email: "pedidos@cafe-el-mirador.test",
		status: "ACTIVE",
		deliveryEnabled: true,
		pickupEnabled: true,
		deliveryFeeMinor: 1500,
		deliveryRadiusKm: 5,
		prepTimeMinutes: 15,
		minOrderMinor: 2500,
		hours: weekHours(390, 1260, {
			0: { opensMinute: 480, closesMinute: 1200 },
		}),
		isVerified: true,
		owner: {
			name: "Diego Ramírez Solano",
			email: "diego.ramirez@pymeshub.test",
		},
		staff: [
			{
				name: "Elena Vargas Mora",
				email: "elena.vargas@pymeshub.test",
				role: "MANAGER",
			},
		],
		products: [
			{
				key: "capuchino",
				categoryKey: "cafe",
				name: "Capuchino",
				description: "Doble espresso, leche vaporizada y muy poca espuma.",
				priceMinor: 2400,
				sku: "MIR-001",
				isFeatured: true,
				prepTimeMinutes: 6,
				tags: ["caliente", "favorito"],
				groups: [
					{
						name: "Leche",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Entera", priceDeltaMinor: 0, isDefault: true },
							{ name: "Descremada", priceDeltaMinor: 0 },
							{ name: "De almendras", priceDeltaMinor: 400 },
						],
					},
					{
						name: "Tamaño",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "8 oz", priceDeltaMinor: 0, isDefault: true },
							{ name: "12 oz", priceDeltaMinor: 500 },
						],
					},
				],
			},
			{
				key: "latte",
				categoryKey: "cafe",
				name: "Latte",
				description: "Más leche, menos espuma, mismo café.",
				priceMinor: 2600,
				sku: "MIR-002",
				prepTimeMinutes: 6,
				groups: [
					{
						name: "Leche",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Entera", priceDeltaMinor: 0, isDefault: true },
							{ name: "De almendras", priceDeltaMinor: 400 },
						],
					},
				],
			},
			{
				key: "espresso",
				categoryKey: "cafe",
				name: "Espresso",
				description: "Corto, denso y sin disculpas.",
				priceMinor: 1600,
				sku: "MIR-003",
				prepTimeMinutes: 4,
				groups: [
					{
						name: "Tamaño",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Sencillo", priceDeltaMinor: 0, isDefault: true },
							{ name: "Doble", priceDeltaMinor: 700 },
						],
					},
				],
			},
			{
				key: "mocaccino",
				categoryKey: "cafe",
				name: "Mocaccino",
				description: "Con chocolate de la casa, no jarabe.",
				priceMinor: 2900,
				sku: "MIR-004",
				isFeatured: true,
				prepTimeMinutes: 7,
				groups: [
					{
						name: "Leche",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Entera", priceDeltaMinor: 0, isDefault: true },
							{ name: "De almendras", priceDeltaMinor: 400 },
						],
					},
				],
			},
			{
				key: "chai",
				categoryKey: "cafe",
				name: "Té chai",
				description: "Especiado, caliente, sin café.",
				priceMinor: 2500,
				sku: "MIR-005",
				prepTimeMinutes: 6,
			},
			{
				key: "croissant",
				categoryKey: "cafe",
				name: "Croissant de almendra",
				description: "Horneado en la mañana, se acaba antes del mediodía.",
				priceMinor: 2100,
				sku: "MIR-006",
				trackInventory: true,
				stockQuantity: 18,
				prepTimeMinutes: 3,
			},
			{
				key: "queque-zanahoria",
				categoryKey: "cafe",
				name: "Queque de zanahoria",
				description: "Con nuez y betún de queso crema.",
				priceMinor: 2300,
				compareAtPriceMinor: 2700,
				sku: "MIR-007",
				prepTimeMinutes: 3,
			},
			{
				key: "sandwich-pollo",
				categoryKey: "cafe",
				name: "Sándwich de pollo",
				description: "Pollo desmenuzado, tomate y lechuga, en pan del día.",
				priceMinor: 3900,
				sku: "MIR-008",
				trackInventory: false,
				prepTimeMinutes: 10,
				groups: [
					{
						name: "Pan",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Blanco", priceDeltaMinor: 0, isDefault: true },
							{ name: "Integral", priceDeltaMinor: 0 },
							{ name: "Ciabatta", priceDeltaMinor: 400 },
						],
					},
					{
						name: "Extras",
						kind: "MULTI",
						minSelect: 0,
						maxSelect: 2,
						options: [
							{ name: "Aguacate", priceDeltaMinor: 500 },
							{ name: "Queso", priceDeltaMinor: 400 },
						],
					},
				],
			},
		],
	},
	{
		key: "trigo",
		slug: "panaderia-trigo-de-oro",
		name: "Panadería Trigo de Oro",
		description:
			"Pan de leña desde las cuatro de la mañana. Si no está en el mostrador, no está.",
		categoryKey: "panaderia",
		city: "Heredia",
		region: "Heredia",
		lat: 10.0024,
		lng: -84.1165,
		phone: "+506 5555 0103",
		email: "mostrador@trigo-de-oro.test",
		status: "ACTIVE",
		deliveryEnabled: false,
		pickupEnabled: true,
		deliveryFeeMinor: 0,
		deliveryRadiusKm: 0,
		prepTimeMinutes: 20,
		minOrderMinor: 1500,
		hours: weekHours(240, 1140, { 0: null }),
		isVerified: false,
		owner: { name: "Flor Rojas Campos", email: "flor.rojas@pymeshub.test" },
		staff: [],
		products: [
			{
				key: "pan-casero",
				categoryKey: "panaderia",
				name: "Pan casero",
				description: "Hogaza de corteza dura y miga densa.",
				priceMinor: 1800,
				sku: "TRI-001",
				isFeatured: true,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Presentación",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Una unidad", priceDeltaMinor: 0, isDefault: true },
							{ name: "Media docena", priceDeltaMinor: 5400 },
							{ name: "Docena", priceDeltaMinor: 10000 },
						],
					},
				],
			},
			{
				key: "concha",
				categoryKey: "panaderia",
				name: "Concha",
				description: "La de azúcar, no la de chocolate. Discúlpennos.",
				priceMinor: 900,
				sku: "TRI-002",
				trackInventory: true,
				stockQuantity: 60,
				prepTimeMinutes: 3,
			},
			{
				key: "orejas",
				categoryKey: "panaderia",
				name: "Orejas",
				description: "Hojaldre con azúcar caramelizada.",
				priceMinor: 1100,
				sku: "TRI-003",
				trackInventory: true,
				stockQuantity: 40,
				prepTimeMinutes: 3,
			},
			{
				key: "empanada-chiverre",
				categoryKey: "panaderia",
				name: "Empanada de chiverre",
				description: "Solo en Semana Santa, y solo si alcanza.",
				priceMinor: 1600,
				sku: "TRI-004",
				trackInventory: true,
				stockQuantity: 12,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Cobertura",
						kind: "MULTI",
						minSelect: 0,
						maxSelect: 1,
						options: [
							{ name: "Azúcar en polvo", priceDeltaMinor: 0, isDefault: true },
							{ name: "Ajonjolí", priceDeltaMinor: 200 },
						],
					},
				],
			},
			{
				key: "pan-coco",
				categoryKey: "panaderia",
				name: "Pan de coco",
				description: "Dulce, húmedo, y el que más se vende los domingos.",
				priceMinor: 1300,
				sku: "TRI-005",
				isFeatured: true,
				trackInventory: true,
				stockQuantity: 36,
				prepTimeMinutes: 3,
			},
			{
				key: "rosquillas",
				categoryKey: "panaderia",
				name: "Rosquillas",
				description: "De maíz, con queso salado adentro.",
				priceMinor: 1400,
				sku: "TRI-006",
				trackInventory: true,
				stockQuantity: 48,
				prepTimeMinutes: 3,
			},
			{
				key: "torta-chilena",
				categoryKey: "panaderia",
				name: "Torta chilena",
				description: "Capas finas de hojaldre y dulce de leche.",
				priceMinor: 4200,
				compareAtPriceMinor: 4800,
				sku: "TRI-007",
				isFeatured: true,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Porción",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Individual", priceDeltaMinor: 0, isDefault: true },
							{ name: "Para compartir", priceDeltaMinor: 3800 },
						],
					},
				],
			},
			{
				key: "cafe-trigo",
				categoryKey: "panaderia",
				name: "Café chorreado",
				description: "Para llevar, en vaso de cartón.",
				priceMinor: 1100,
				sku: "TRI-008",
				prepTimeMinutes: 4,
			},
		],
	},
	{
		key: "cosecha",
		slug: "fruteria-la-cosecha",
		name: "Frutería La Cosecha",
		description: "Fruta de la zona, comprada a los que la siembran.",
		categoryKey: "frutas",
		city: "Cartago",
		region: "Cartago",
		lat: 9.8644,
		lng: -83.9194,
		phone: "+506 5555 0104",
		email: "pedidos@la-cosecha.test",
		status: "SUSPENDED",
		deliveryEnabled: true,
		pickupEnabled: false,
		deliveryFeeMinor: 1200,
		deliveryRadiusKm: 4,
		prepTimeMinutes: 40,
		minOrderMinor: 4000,
		hours: weekHours(300, 1080, { 0: { opensMinute: 360, closesMinute: 780 } }),
		isVerified: true,
		owner: {
			name: "Gabriel Arias Núñez",
			email: "gabriel.arias@pymeshub.test",
		},
		staff: [],
		products: [
			{
				key: "banano",
				categoryKey: "frutas",
				name: "Banano",
				description: "De la zona de Turrialba, maduro en su punto.",
				priceMinor: 950,
				sku: "COS-001",
				isFeatured: true,
				trackInventory: true,
				stockQuantity: 80,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Presentación",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Kilo", priceDeltaMinor: 0, isDefault: true },
							{ name: "Media caja", priceDeltaMinor: 2600 },
							{ name: "Caja completa", priceDeltaMinor: 5000 },
						],
					},
				],
			},
			{
				key: "papaya",
				categoryKey: "frutas",
				name: "Papaya",
				description: "Grande, dulce, y ya madura.",
				priceMinor: 1600,
				sku: "COS-002",
				trackInventory: true,
				stockQuantity: 25,
				prepTimeMinutes: 5,
			},
			{
				key: "pina",
				categoryKey: "frutas",
				name: "Piña",
				description: "Con el olor que dice si está lista.",
				priceMinor: 1400,
				sku: "COS-003",
				trackInventory: true,
				stockQuantity: 30,
				prepTimeMinutes: 5,
			},
			{
				key: "aguacate",
				categoryKey: "frutas",
				name: "Aguacate",
				description: "Criollo, no hass, como corresponde.",
				priceMinor: 2400,
				compareAtPriceMinor: 2900,
				sku: "COS-004",
				trackInventory: true,
				stockQuantity: 40,
				prepTimeMinutes: 5,
				groups: [
					{
						name: "Madurez",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Para hoy", priceDeltaMinor: 0 },
							{ name: "Para dos días", priceDeltaMinor: 0, isDefault: true },
						],
					},
				],
			},
			{
				key: "tomate",
				categoryKey: "frutas",
				name: "Tomate",
				description: "De invernadero, parejo y firme.",
				priceMinor: 1300,
				sku: "COS-005",
				trackInventory: true,
				stockQuantity: 50,
				prepTimeMinutes: 5,
			},
			{
				key: "cebolla",
				categoryKey: "frutas",
				name: "Cebolla",
				description: "Blanca, de la que no hace llorar tanto.",
				priceMinor: 1200,
				sku: "COS-006",
				trackInventory: true,
				stockQuantity: 45,
				prepTimeMinutes: 5,
			},
			{
				key: "caja-surtida",
				categoryKey: "frutas",
				name: "Caja de frutas surtidas",
				description: "Lo que esté bueno esa semana, sin escoger.",
				priceMinor: 8500,
				sku: "COS-007",
				isFeatured: true,
				trackInventory: true,
				stockQuantity: 10,
				prepTimeMinutes: 15,
				groups: [
					{
						name: "Tamaño",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Familiar", priceDeltaMinor: 0, isDefault: true },
							{ name: "Grande", priceDeltaMinor: 3500 },
						],
					},
				],
			},
			{
				key: "jugo-natural",
				categoryKey: "frutas",
				name: "Jugo natural",
				description: "Hecho al momento, en botella de litro.",
				priceMinor: 1800,
				sku: "COS-008",
				prepTimeMinutes: 8,
				groups: [
					{
						name: "Sabor",
						kind: "SINGLE",
						isRequired: true,
						maxSelect: 1,
						options: [
							{ name: "Naranja", priceDeltaMinor: 0, isDefault: true },
							{ name: "Piña", priceDeltaMinor: 0 },
							{ name: "Zanahoria", priceDeltaMinor: 200 },
						],
					},
				],
			},
		],
	},
];

type SeedCustomer = {
	name: string;
	email: string;
	addresses: {
		label: string;
		line1: string;
		city: string;
		region: string;
		lat: number;
		lng: number;
		isDefault: boolean;
	}[];
};

const CUSTOMERS: SeedCustomer[] = [
	{
		name: "Helena Prado Jiménez",
		email: "helena.prado@pymeshub.test",
		addresses: [
			{
				label: "Casa",
				line1: "Avenida 6, calle 11, 100 m este del parque",
				city: "San José",
				region: "San José",
				lat: 9.9325,
				lng: -84.0798,
				isDefault: true,
			},
			{
				label: "Oficina",
				line1: "Calle 3, avenida 2, edificio gris, piso 4",
				city: "San José",
				region: "San José",
				lat: 9.9361,
				lng: -84.0889,
				isDefault: false,
			},
		],
	},
	{
		name: "Iván Cordero Blanco",
		email: "ivan.cordero@pymeshub.test",
		addresses: [
			{
				label: "Casa",
				line1: "Calle Monge, 200 m norte de la escuela",
				city: "Escazú",
				region: "San José",
				lat: 9.9203,
				lng: -84.1421,
				isDefault: true,
			},
		],
	},
	{
		name: "Jimena Salas Chacón",
		email: "jimena.salas@pymeshub.test",
		addresses: [
			{
				label: "Casa",
				line1: "Avenida central, 50 m oeste del mercado",
				city: "Cartago",
				region: "Cartago",
				lat: 9.8661,
				lng: -83.9201,
				isDefault: true,
			},
		],
	},
];

const ADMIN = { name: "Karla Ureña Ríos", email: "admin@pymeshub.test" };

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

type OrderItemSpec = {
	product: string;
	quantity: number;
	withExtras?: boolean;
};

type OrderSpec = {
	key: string;
	reference: string;
	business: string;
	customer: number;
	fulfilment: FulfilmentKind;
	status: OrderStatus;
	paymentMethod: "CASH" | "SINPE_MOVIL";
	orderedDaysAgo: number;
	items: OrderItemSpec[];
	address?: number;
	courier?: { name: string; phone: string };
	cancelReason?: string;
	note?: string;
	promotionCode?: string;
	review?: { rating: number; comment: string; product?: string };
	scheduledInDays?: number;
};

/**
 * Every status in the union appears at least once, and one delivery is left
 * `OUT_FOR_DELIVERY` with a courier on it — a tracker with nothing to track is
 * the state nobody remembers to seed.
 */
const ORDERS: OrderSpec[] = [
	{
		key: "o01",
		reference: "PYM-4K7M2Q",
		business: "yunta",
		customer: 0,
		fulfilment: "DELIVERY",
		status: "COMPLETED",
		paymentMethod: "SINPE_MOVIL",
		orderedDaysAgo: 9,
		items: [
			{ product: "casado-pollo", quantity: 2, withExtras: true },
			{ product: "tres-leches", quantity: 1 },
		],
		address: 0,
		promotionCode: "YUNTA10",
		note: "Sin cebolla en la ensalada, por favor.",
		review: {
			rating: 5,
			comment:
				"Llegó caliente y completo. El tres leches es el mejor de San José.",
			product: "tres-leches",
		},
	},
	{
		key: "o02",
		reference: "PYM-8N3P5R",
		business: "yunta",
		customer: 1,
		fulfilment: "PICKUP",
		status: "COMPLETED",
		paymentMethod: "CASH",
		orderedDaysAgo: 6,
		items: [
			{ product: "gallo-pinto", quantity: 3 },
			{ product: "cafe-chorreado", quantity: 2 },
		],
		review: {
			rating: 4,
			comment: "Buen desayuno y a buen precio. El café podría ser más fuerte.",
		},
	},
	{
		key: "o03",
		reference: "PYM-2T6W9X",
		business: "mirador",
		customer: 0,
		fulfilment: "DELIVERY",
		status: "OUT_FOR_DELIVERY",
		paymentMethod: "CASH",
		orderedDaysAgo: 0,
		items: [
			{ product: "capuchino", quantity: 2, withExtras: true },
			{ product: "croissant", quantity: 2 },
		],
		address: 0,
		courier: { name: "Luis Montero", phone: "+506 5555 0201" },
		note: "Dejar en la recepción si no contesto.",
	},
	{
		key: "o04",
		reference: "PYM-7B4C1D",
		business: "trigo",
		customer: 2,
		fulfilment: "PICKUP",
		status: "READY",
		paymentMethod: "CASH",
		orderedDaysAgo: 0,
		items: [
			{ product: "pan-casero", quantity: 1, withExtras: true },
			{ product: "concha", quantity: 6 },
			{ product: "torta-chilena", quantity: 1 },
		],
	},
	{
		key: "o05",
		reference: "PYM-3F8G5H",
		business: "cosecha",
		customer: 1,
		fulfilment: "DELIVERY",
		status: "PREPARING",
		paymentMethod: "SINPE_MOVIL",
		orderedDaysAgo: 0,
		items: [
			{ product: "caja-surtida", quantity: 1 },
			{ product: "jugo-natural", quantity: 2 },
		],
		address: 0,
	},
	{
		key: "o06",
		reference: "PYM-9J2K6L",
		business: "yunta",
		customer: 2,
		fulfilment: "PICKUP",
		status: "ACCEPTED",
		paymentMethod: "CASH",
		orderedDaysAgo: 1,
		items: [
			{ product: "olla-carne", quantity: 1 },
			{ product: "agua-dulce", quantity: 1 },
		],
	},
	{
		key: "o07",
		reference: "PYM-5M7N1P",
		business: "mirador",
		customer: 1,
		fulfilment: "DELIVERY",
		status: "PENDING",
		paymentMethod: "SINPE_MOVIL",
		orderedDaysAgo: 0,
		items: [
			{ product: "sandwich-pollo", quantity: 1, withExtras: true },
			{ product: "latte", quantity: 1 },
		],
		address: 0,
	},
	{
		key: "o08",
		reference: "PYM-6Q9R3S",
		business: "trigo",
		customer: 0,
		fulfilment: "PICKUP",
		status: "CANCELLED",
		paymentMethod: "CASH",
		orderedDaysAgo: 4,
		items: [{ product: "rosquillas", quantity: 12 }],
		cancelReason: "La clienta no pudo llegar antes del cierre.",
	},
	{
		key: "o09",
		reference: "PYM-2V4W8X",
		business: "cosecha",
		customer: 2,
		fulfilment: "DELIVERY",
		status: "REJECTED",
		paymentMethod: "CASH",
		orderedDaysAgo: 3,
		items: [{ product: "banano", quantity: 3 }],
		address: 0,
		cancelReason: "Fuera del área de entrega a esa hora.",
	},
	{
		key: "o10",
		reference: "PYM-7Y1Z5B",
		business: "mirador",
		customer: 2,
		fulfilment: "DELIVERY",
		status: "COMPLETED",
		paymentMethod: "SINPE_MOVIL",
		orderedDaysAgo: 14,
		items: [
			{ product: "mocaccino", quantity: 2 },
			{ product: "queque-zanahoria", quantity: 2 },
		],
		address: 0,
		review: {
			rating: 3,
			comment:
				"Todo bien, pero llegó veinte minutos tarde y el queque venía seco.",
		},
	},
	{
		key: "o11",
		reference: "PYM-3C6D9F",
		business: "cosecha",
		customer: 0,
		fulfilment: "PICKUP",
		status: "COMPLETED",
		paymentMethod: "CASH",
		orderedDaysAgo: 21,
		items: [
			{ product: "papaya", quantity: 1 },
			{ product: "pina", quantity: 2 },
			{ product: "aguacate", quantity: 4 },
		],
		review: {
			rating: 5,
			comment: "Fruta fresca y el precio es justo. Vuelvo cada quince días.",
			product: "aguacate",
		},
	},
	{
		key: "o12",
		reference: "PYM-8G2H4J",
		business: "trigo",
		customer: 1,
		fulfilment: "PICKUP",
		status: "PENDING",
		paymentMethod: "CASH",
		orderedDaysAgo: 0,
		items: [
			{ product: "empanada-chiverre", quantity: 4 },
			{ product: "pan-coco", quantity: 6 },
		],
		scheduledInDays: 2,
	},
];

// ---------------------------------------------------------------------------
// Row building
// ---------------------------------------------------------------------------

/** The order the rows are written in; foreign keys require it. */
const userRows: NewUser[] = [];
const categoryRows: NewCategory[] = [];
const businessRows: NewBusiness[] = [];
const membershipRows: NewMembership[] = [];
const productRows: NewProduct[] = [];
const optionGroupRows: NewProductOptionGroup[] = [];
const optionRows: NewProductOption[] = [];
const addressRows: NewAddress[] = [];
const cartRows: NewCart[] = [];
const cartItemRows: NewCartItem[] = [];
const promotionRows: NewPromotion[] = [];
const orderRows: NewOrder[] = [];
const orderItemRows: NewOrderItem[] = [];
const orderEventRows: NewOrderEvent[] = [];
const reviewRows: NewReview[] = [];
const favoriteRows: NewFavorite[] = [];
const notificationRows: NewNotification[] = [];
const payoutRows: NewPayout[] = [];
const auditRows: NewAuditLog[] = [];

// ---------------------------------------------------------------------------
// Demo credentials
// ---------------------------------------------------------------------------

/**
 * The password every seeded account signs in with.
 *
 * The `user` rows are enough to *display* a customer, but not to sign in as one: Better Auth
 * authenticates against `auth_account`, and a credential row there needs a password hash.
 * Without this block all eleven seeded people render in the admin's list and refuse every
 * attempt to log in as them, which reads as "sign-in is broken" rather than "the seed has no
 * credentials".
 *
 * The hash is written out literally rather than computed here, and that is the entire reason
 * it is a constant: `hashPassword` salts randomly, so calling it would make the output differ
 * on every run and break the byte-identical promise at the top of this file. Regenerate it
 * after changing the password above with:
 *
 *   bun -e 'import { hashPassword } from "better-auth/crypto";
 *           console.log(await hashPassword(process.argv[1]))' 'pymeshub-demo-2026'
 *
 * This password is public — it is in this file, in the README and in the repository's
 * history. That is why these rows go to `seed-credentials.sql` and *not* to `seed.sql`:
 * `db:seed:remote` applies `seed.sql` to a deployed database, and a deployed database must
 * never grow an account whose password is in the source.
 */
const DEMO_PASSWORD = "pymeshub-demo-2026";

/** scrypt, as Better Auth's own `hashPassword` produces it: `salt:hexDigest`. */
const DEMO_PASSWORD_HASH =
	"bfa1f1e55c211bc4b1b5a1d6975ce6a7:23c47909a7c117faffe16015b6a29e4c43d27b8fe913bcb76fedf31f50ba1845a21d5203e380d967b17ffd005ad43de63e747b9e46d547c588e62fa775f3af11";

const accountRows: NewAccount[] = [];

function addUser(
	id: string,
	name: string,
	email: string,
	isAdmin: boolean,
	createdAt: Date,
) {
	userRows.push({
		id,
		name,
		email,
		emailVerified: true,
		image: null,
		phone: null,
		isAdmin,
		suspendedAt: null,
		createdAt,
		updatedAt: createdAt,
	});

	// One credential per person, so every seeded account is one a reviewer can sign in as.
	// `accountId` is the user's id: for a `credential` account Better Auth's account id *is*
	// the user id, and a value invented here would be a second identity for the same person.
	const accountIndex = accountRows.length + 1;
	accountRows.push({
		id: seedId(ID_PREFIXES.account, accountIndex),
		accountId: id,
		providerId: "credential",
		userId: id,
		password: DEMO_PASSWORD_HASH,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		scope: null,
		accessTokenExpiresAt: null,
		refreshTokenExpiresAt: null,
		createdAt,
		updatedAt: createdAt,
	});
}

const adminId = seedId(ID_PREFIXES.user, 1);
addUser(adminId, ADMIN.name, ADMIN.email, true, daysAgo(120));

const customerIds = CUSTOMERS.map((customer, index) => {
	const id = seedId(ID_PREFIXES.user, index + 2);
	addUser(id, customer.name, customer.email, false, daysAgo(90 - index * 7));
	return id;
});

const ownerIds = new Map<string, string>();
const businessIds = new Map<string, string>();
const productIds = new Map<string, string>();

interface BuiltOption {
	row: NewProductOption;
	spec: OptionSpec;
}

interface BuiltGroup {
	row: NewProductOptionGroup;
	options: BuiltOption[];
}

interface BuiltProduct {
	row: NewProduct;
	groups: BuiltGroup[];
}

const productsByKey = new Map<string, BuiltProduct>();
const businessesByKey = new Map<string, BusinessSpec>();

for (const [categoryIndex, spec] of CATEGORIES.entries()) {
	categoryRows.push({
		id: seedId(ID_PREFIXES.category, categoryIndex + 1),
		slug: spec.slug,
		name: spec.name,
		iconName: spec.iconName,
		imageUrl: null,
		parentId: spec.parentKey
			? seedId(
					ID_PREFIXES.category,
					CATEGORIES.findIndex(
						(candidate) => candidate.key === spec.parentKey,
					) + 1,
				)
			: null,
		sortOrder: categoryIndex,
		isActive: true,
	});
}

const categoryIdByKey = new Map(
	CATEGORIES.map((spec, index) => [
		spec.key,
		seedId(ID_PREFIXES.category, index + 1),
	]),
);

let userCursor = customerIds.length + 1;
let membershipCursor = 0;
let productCursor = 0;
let optionGroupCursor = 0;
let optionCursor = 0;

for (const [businessIndex, spec] of BUSINESSES.entries()) {
	const id = seedId(ID_PREFIXES.business, businessIndex + 1);
	businessIds.set(spec.key, id);
	businessesByKey.set(spec.key, spec);

	ownerIds.set(spec.key, seedId(ID_PREFIXES.user, userCursor + 1));
	addUser(
		seedId(ID_PREFIXES.user, userCursor + 1),
		spec.owner.name,
		spec.owner.email,
		false,
		daysAgo(100 - businessIndex * 5),
	);
	userCursor += 1;

	const businessCreatedAt = daysAgo(100 - businessIndex * 5);

	businessRows.push({
		id,
		slug: spec.slug,
		name: spec.name,
		description: spec.description,
		logoUrl: null,
		coverUrl: null,
		phone: spec.phone,
		email: spec.email,
		categoryId: categoryIdByKey.get(spec.categoryKey) ?? null,
		line1: null,
		line2: null,
		city: spec.city,
		region: spec.region,
		country: "Costa Rica",
		postalCode: null,
		lat: spec.lat,
		lng: spec.lng,
		geohash: encodeGeohash(spec.lat, spec.lng),
		hours: spec.hours,
		currency: CRC,
		status: spec.status,
		isVerified: spec.isVerified,
		// Filled in below, once the reviews that justify them exist.
		ratingAvg: 0,
		ratingCount: 0,
		deliveryEnabled: spec.deliveryEnabled,
		pickupEnabled: spec.pickupEnabled,
		deliveryFeeMinor: spec.deliveryFeeMinor,
		deliveryRadiusKm: spec.deliveryEnabled ? spec.deliveryRadiusKm : null,
		prepTimeMinutes: spec.prepTimeMinutes,
		minOrderMinor: spec.minOrderMinor,
		createdAt: businessCreatedAt,
		updatedAt: businessCreatedAt,
	});

	membershipRows.push({
		id: seedId(ID_PREFIXES.membership, membershipCursor + 1),
		businessId: id,
		userId: seedId(ID_PREFIXES.user, userCursor),
		role: "OWNER",
		createdAt: businessCreatedAt,
	});
	membershipCursor += 1;

	for (const member of spec.staff) {
		const memberId = seedId(ID_PREFIXES.user, userCursor + 1);
		addUser(memberId, member.name, member.email, false, daysAgo(60));
		userCursor += 1;
		membershipRows.push({
			id: seedId(ID_PREFIXES.membership, membershipCursor + 1),
			businessId: id,
			userId: memberId,
			role: member.role,
			createdAt: daysAgo(60),
		});
		membershipCursor += 1;
	}

	for (const productSpec of spec.products) {
		productCursor += 1;
		const productId = seedId(ID_PREFIXES.product, productCursor);
		productIds.set(`${spec.key}:${productSpec.key}`, productId);

		const createdAt = daysAgo(80 - (productCursor % 30));
		const row: NewProduct = {
			id: productId,
			businessId: id,
			categoryId: categoryIdByKey.get(productSpec.categoryKey) ?? null,
			name: productSpec.name,
			description: productSpec.description,
			imageUrl: null,
			images: [],
			priceMinor: productSpec.priceMinor,
			compareAtPriceMinor: productSpec.compareAtPriceMinor ?? null,
			currency: CRC,
			sku: productSpec.sku,
			status: "ACTIVE",
			isFeatured: productSpec.isFeatured ?? false,
			trackInventory: productSpec.trackInventory ?? false,
			stockQuantity: productSpec.stockQuantity ?? 0,
			prepTimeMinutes: productSpec.prepTimeMinutes ?? spec.prepTimeMinutes,
			tags: productSpec.tags ?? [],
			ratingAvg: 0,
			ratingCount: 0,
			soldCount: 0,
			sortOrder: productCursor,
			archivedAt: null,
			createdAt,
			updatedAt: createdAt,
		};

		const groups: BuiltGroup[] = [];
		for (const [groupIndex, groupSpec] of (
			productSpec.groups ?? []
		).entries()) {
			optionGroupCursor += 1;
			const groupId = seedId(ID_PREFIXES.optionGroup, optionGroupCursor);
			groups.push({
				row: {
					id: groupId,
					productId,
					name: groupSpec.name,
					kind: groupSpec.kind,
					isRequired: groupSpec.isRequired ?? false,
					minSelect: groupSpec.minSelect ?? (groupSpec.isRequired ? 1 : 0),
					maxSelect: groupSpec.maxSelect ?? 1,
					sortOrder: groupIndex,
				},
				options: groupSpec.options.map((optionSpec, optionIndex) => {
					optionCursor += 1;
					return {
						row: {
							id: seedId(ID_PREFIXES.option, optionCursor),
							groupId,
							name: optionSpec.name,
							priceDeltaMinor: optionSpec.priceDeltaMinor,
							isDefault: optionSpec.isDefault ?? false,
							isAvailable: true,
							sortOrder: optionIndex,
						},
						spec: optionSpec,
					};
				}),
			});
		}

		for (const group of groups) {
			optionGroupRows.push(group.row);
			for (const option of group.options) optionRows.push(option.row);
		}

		const built: BuiltProduct = { row, groups };
		productsByKey.set(`${spec.key}:${productSpec.key}`, built);
		productRows.push(row);
	}
}

// Addresses, one row per address, id allocated in customer order.
let addressCursor = 0;
const addressIds = CUSTOMERS.map((customer) =>
	customer.addresses.map(() => {
		addressCursor += 1;
		return seedId(ID_PREFIXES.address, addressCursor);
	}),
);

CUSTOMERS.forEach((customer, customerIndex) => {
	customer.addresses.forEach((spec, addressIndex) => {
		addressRows.push({
			id: addressIds[customerIndex]?.[addressIndex] as string,
			userId: customerIds[customerIndex] as string,
			label: spec.label,
			line1: spec.line1,
			line2: null,
			city: spec.city,
			region: spec.region,
			country: "Costa Rica",
			postalCode: null,
			lat: spec.lat,
			lng: spec.lng,
			phone: null,
			instructions: null,
			isDefault: spec.isDefault,
		});
	});
});

/**
 * The chosen options for a product, as a snapshot. Deterministic on purpose: the
 * same product in the same demo always produces the same line, so a diff means a
 * change rather than a coin flip.
 */
function chooseOptions(
	product: BuiltProduct,
	withExtras = false,
): ChosenOption[] {
	const chosen: ChosenOption[] = [];

	for (const group of product.groups) {
		if (group.row.kind === "MULTI") {
			if (!withExtras) continue;
			const first = group.options[0];
			if (!first) continue;
			chosen.push({
				groupId: group.row.id,
				groupName: group.row.name,
				optionId: first.row.id,
				name: first.row.name,
				priceDeltaMinor: first.row.priceDeltaMinor ?? 0,
			});
			continue;
		}

		const option =
			group.options.find((candidate) => candidate.spec.isDefault) ??
			group.options[0];
		if (!option) continue;
		chosen.push({
			groupId: group.row.id,
			groupName: group.row.name,
			optionId: option.row.id,
			name: option.row.name,
			priceDeltaMinor: option.row.priceDeltaMinor ?? 0,
		});
	}

	return chosen;
}

/**
 * `optionDelta` and `optionsHash` are imported rather than defined here, and that is
 * a correctness requirement rather than tidiness: the API mints the same fingerprint
 * when a customer adds a line to a cart, and `cart_item` carries a unique index on
 * `(cartId, productId, optionsHash)`. Two implementations that drift do not produce a
 * cosmetic difference — they produce a duplicate line that reaches the order.
 *
 * The `ChosenOption` type here is Drizzle's inferred shape of the JSON column; the
 * shared functions take the two fields they read, so the two agree structurally
 * without this file depending on the API's types.
 */

// --- carts ------------------------------------------------------------------

const cartIds = customerIds.map((_, index) =>
	seedId(ID_PREFIXES.cart, index + 1),
);
let cartItemCursor = 0;

// One open cart with two lines, and one already checked out: the two states a
// customer's cart is actually found in.
const CART_SPECS: {
	customer: number;
	business: string;
	status: "OPEN" | "CHECKED_OUT";
	items: OrderItemSpec[];
}[] = [
	{
		customer: 0,
		business: "mirador",
		status: "OPEN",
		// Two lines of one product, configured differently — which is the only way the
		// cart's unique index on the options hash is exercised. A pair that collapsed
		// to the same hash would collide here instead of in production.
		items: [
			{ product: "sandwich-pollo", quantity: 1 },
			{ product: "sandwich-pollo", quantity: 2, withExtras: true },
		],
	},
	{
		customer: 1,
		business: "trigo",
		status: "CHECKED_OUT",
		items: [{ product: "concha", quantity: 4 }],
	},
];

for (const spec of CART_SPECS) {
	const cartId = cartIds[spec.customer] as string;
	const businessId = businessIds.get(spec.business) as string;
	const createdAt = daysAgo(2);

	cartRows.push({
		id: cartId,
		userId: customerIds[spec.customer] as string,
		businessId,
		status: spec.status,
		currency: CRC,
		promotionCode: null,
		createdAt,
		updatedAt: createdAt,
	});

	for (const item of spec.items) {
		cartItemCursor += 1;
		const built = productsByKey.get(`${spec.business}:${item.product}`);
		if (!built) throw new Error(`Unknown product in cart: ${item.product}`);
		const chosen = chooseOptions(built, item.withExtras);
		cartItemRows.push({
			id: seedId(ID_PREFIXES.cartItem, cartItemCursor),
			cartId,
			productId: built.row.id,
			quantity: item.quantity,
			unitPriceMinor: built.row.priceMinor + optionDelta(chosen),
			options: chosen,
			optionsHash: optionsHash(chosen),
			notes: null,
		});
	}
}

// --- promotions -------------------------------------------------------------

promotionRows.push({
	id: seedId(ID_PREFIXES.promotion, 1),
	businessId: businessIds.get("yunta") as string,
	code: "YUNTA10",
	kind: "PERCENT",
	value: 10,
	minOrderMinor: 5000,
	maxRedemptions: 100,
	redemptions: 7,
	startsAt: daysAgo(30),
	endsAt: daysAgo(-30),
	isActive: true,
});

// --- orders -----------------------------------------------------------------

type OrderStep = { to: OrderStatus; actor: OrderActor };

const ACCEPTED: OrderStep = { to: "ACCEPTED", actor: "BUSINESS" };
const PREPARING: OrderStep = { to: "PREPARING", actor: "BUSINESS" };
const READY: OrderStep = { to: "READY", actor: "BUSINESS" };

/**
 * How an order reaches each terminal state. Not a plain `Record<OrderStatus, …>`:
 * `READY -> COMPLETED` is a pickup being handed over the counter and is declared
 * for `PICKUP` only, so a completed delivery has to be walked through
 * `OUT_FOR_DELIVERY` or the history it produces is one the API would refuse.
 */
function orderPath(
	status: OrderStatus,
	fulfilment: FulfilmentKind,
): OrderStep[] {
	const handedOver: OrderStep[] =
		fulfilment === "DELIVERY"
			? [
					{ to: "OUT_FOR_DELIVERY", actor: "COURIER" },
					{ to: "COMPLETED", actor: "COURIER" },
				]
			: [{ to: "COMPLETED", actor: "BUSINESS" }];

	switch (status) {
		case "PENDING":
			return [];
		case "ACCEPTED":
			return [ACCEPTED];
		case "PREPARING":
			return [ACCEPTED, PREPARING];
		case "READY":
			return [ACCEPTED, PREPARING, READY];
		case "OUT_FOR_DELIVERY":
			return [
				ACCEPTED,
				PREPARING,
				READY,
				{ to: "OUT_FOR_DELIVERY", actor: "COURIER" },
			];
		case "COMPLETED":
			return [ACCEPTED, PREPARING, READY, ...handedOver];
		case "CANCELLED":
			return [ACCEPTED, { to: "CANCELLED", actor: "CUSTOMER" }];
		case "REJECTED":
			return [{ to: "REJECTED", actor: "BUSINESS" }];
	}
}

/**
 * The chain is checked against `canTransition` rather than trusted, because a
 * seed that produces an order history the API would refuse is a seed that lets a
 * tracker render a step that can never happen.
 */
function checkedOrderPath(
	status: OrderStatus,
	fulfilment: FulfilmentKind,
): OrderStep[] {
	const path = orderPath(status, fulfilment);
	let from: OrderStatus = "PENDING";

	for (const step of path) {
		if (!canTransition({ from, to: step.to, actor: step.actor, fulfilment })) {
			throw new Error(
				`Seed order path is illegal: ${from} -> ${step.to} by ${step.actor} (${fulfilment})`,
			);
		}
		from = step.to;
	}

	if (from !== status) {
		throw new Error(`Seed order path for ${status} ends at ${from}`);
	}

	return path;
}

let orderItemCursor = 0;
let orderEventCursor = 0;
let reviewCursor = 0;

/** Rating aggregates, accumulated as the reviews are written. */
const businessRatings = new Map<string, { total: number; count: number }>();
const productRatings = new Map<string, { total: number; count: number }>();
const productSales = new Map<string, number>();

for (const [orderIndex, spec] of ORDERS.entries()) {
	const businessSpec = businessesByKey.get(spec.business);
	if (!businessSpec) throw new Error(`Unknown business: ${spec.business}`);
	const businessId = businessIds.get(spec.business) as string;
	const placedAt = daysAgo(spec.orderedDaysAgo, 6);
	const orderId = seedId(ID_PREFIXES.order, orderIndex + 1);

	const lines: NewOrderItem[] = [];
	let subtotalMinor = 0;

	for (const item of spec.items) {
		const built = productsByKey.get(`${spec.business}:${item.product}`);
		if (!built) throw new Error(`Unknown product: ${item.product}`);
		const chosen = chooseOptions(built, item.withExtras);
		const unitPriceMinor = built.row.priceMinor + optionDelta(chosen);
		const lineTotalMinor = unitPriceMinor * item.quantity;
		subtotalMinor += lineTotalMinor;
		orderItemCursor += 1;

		lines.push({
			id: seedId(ID_PREFIXES.orderItem, orderItemCursor),
			orderId,
			productId: built.row.id,
			nameSnapshot: built.row.name,
			imageUrlSnapshot: built.row.imageUrl ?? null,
			quantity: item.quantity,
			unitPriceMinor,
			options: chosen,
			lineTotalMinor,
			notes: null,
		});

		if (spec.status === "COMPLETED") {
			productSales.set(
				built.row.id,
				(productSales.get(built.row.id) ?? 0) + item.quantity,
			);
		}
	}

	const promotion = spec.promotionCode
		? promotionRows.find((row) => row.code === spec.promotionCode)
		: undefined;
	const discountMinor =
		promotion && promotion.kind === "PERCENT"
			? Math.round((subtotalMinor * promotion.value) / 100)
			: 0;
	const deliveryFeeMinor =
		spec.fulfilment === "DELIVERY" ? businessSpec.deliveryFeeMinor : 0;
	const totalMinor = subtotalMinor - discountMinor + deliveryFeeMinor;

	const path = checkedOrderPath(spec.status, spec.fulfilment);
	const acceptedAt =
		path.length >= 1 ? minutesAfter(placedAt, integer(3, 9)) : null;
	const readyAt =
		path.length >= 3 ? minutesAfter(placedAt, integer(18, 30)) : null;
	const completedAt =
		spec.status === "COMPLETED"
			? minutesAfter(placedAt, integer(35, 70))
			: null;
	const cancelledAt =
		spec.status === "CANCELLED" || spec.status === "REJECTED"
			? minutesAfter(placedAt, integer(2, 12))
			: null;

	orderRows.push({
		id: orderId,
		reference: spec.reference,
		customerId: customerIds[spec.customer] as string,
		businessId,
		addressId:
			spec.fulfilment === "DELIVERY"
				? (addressIds[spec.customer]?.[spec.address ?? 0] as string)
				: null,
		fulfilment: spec.fulfilment,
		status: spec.status,
		paymentMethod: spec.paymentMethod,
		paymentStatus:
			spec.status === "COMPLETED"
				? "PAID"
				: spec.paymentMethod === "SINPE_MOVIL" && spec.status !== "REJECTED"
					? "PAID"
					: "UNPAID",
		currency: CRC,
		subtotalMinor,
		discountMinor,
		deliveryFeeMinor,
		taxMinor: 0,
		tipMinor: 0,
		totalMinor,
		notes: spec.note ?? null,
		scheduledFor: spec.scheduledInDays ? daysAgo(-spec.scheduledInDays) : null,
		placedAt,
		acceptedAt,
		readyAt,
		completedAt,
		cancelledAt,
		cancelReason: spec.cancelReason ?? null,
		courierName: spec.courier?.name ?? null,
		courierPhone: spec.courier?.phone ?? null,
		createdAt: placedAt,
		updatedAt: completedAt ?? cancelledAt ?? readyAt ?? acceptedAt ?? placedAt,
	});

	orderItemRows.push(...lines);

	// The creation event has no from-status: nothing preceded it.
	orderEventCursor += 1;
	orderEventRows.push({
		id: seedId(ID_PREFIXES.orderEvent, orderEventCursor),
		orderId,
		fromStatus: null,
		toStatus: "PENDING",
		actor: "CUSTOMER",
		actorUserId: customerIds[spec.customer] as string,
		note: null,
		createdAt: placedAt,
	});

	for (const [stepIndex, step] of path.entries()) {
		orderEventCursor += 1;
		const from =
			stepIndex === 0 ? "PENDING" : (path[stepIndex - 1]?.to as OrderStatus);
		orderEventRows.push({
			id: seedId(ID_PREFIXES.orderEvent, orderEventCursor),
			orderId,
			fromStatus: from,
			toStatus: step.to,
			actor: step.actor,
			actorUserId:
				step.actor === "BUSINESS"
					? (ownerIds.get(spec.business) as string)
					: step.actor === "CUSTOMER"
						? (customerIds[spec.customer] as string)
						: null,
			note: null,
			createdAt: minutesAfter(placedAt, (stepIndex + 1) * 5),
		});
	}

	if (spec.review) {
		reviewCursor += 1;
		const productId = spec.review.product
			? (productsByKey.get(`${spec.business}:${spec.review.product}`)?.row.id ??
				null)
			: null;
		reviewRows.push({
			id: seedId(ID_PREFIXES.review, reviewCursor),
			orderId,
			businessId,
			customerId: customerIds[spec.customer] as string,
			productId,
			rating: spec.review.rating,
			comment: spec.review.comment,
			createdAt: minutesAfter(completedAt ?? placedAt, 60 * 6),
		});

		const businessTally = businessRatings.get(businessId) ?? {
			total: 0,
			count: 0,
		};
		businessRatings.set(businessId, {
			total: businessTally.total + spec.review.rating,
			count: businessTally.count + 1,
		});

		if (productId) {
			const productTally = productRatings.get(productId) ?? {
				total: 0,
				count: 0,
			};
			productRatings.set(productId, {
				total: productTally.total + spec.review.rating,
				count: productTally.count + 1,
			});
		}
	}
}

/**
 * The denormalised columns are computed from the rows that justify them rather
 * than typed in, because a demo where the rating and the reviews disagree is a
 * demo that hides the bug it was built to catch.
 */
for (const row of businessRows) {
	const tally = businessRatings.get(row.id);
	if (!tally) continue;
	row.ratingCount = tally.count;
	row.ratingAvg = Number((tally.total / tally.count).toFixed(2));
}

for (const row of productRows) {
	const tally = productRatings.get(row.id);
	if (tally) {
		row.ratingCount = tally.count;
		row.ratingAvg = Number((tally.total / tally.count).toFixed(2));
	}
	row.soldCount = productSales.get(row.id) ?? 0;
}

// --- favorites, notifications, payout, audit --------------------------------

favoriteRows.push(
	{
		id: seedId(ID_PREFIXES.favorite, 1),
		userId: customerIds[0] as string,
		businessId: businessIds.get("yunta") as string,
		productId: null,
		createdAt: daysAgo(20),
	},
	{
		id: seedId(ID_PREFIXES.favorite, 2),
		userId: customerIds[0] as string,
		businessId: null,
		productId: productsByKey.get("yunta:tres-leches")?.row.id as string,
		createdAt: daysAgo(20),
	},
	{
		id: seedId(ID_PREFIXES.favorite, 3),
		userId: customerIds[1] as string,
		businessId: businessIds.get("mirador") as string,
		productId: null,
		createdAt: daysAgo(12),
	},
);

notificationRows.push(
	{
		id: seedId(ID_PREFIXES.notification, 1),
		userId: customerIds[0] as string,
		// The kind the consumer writes, and the dedupe key shape it writes with it:
		// `event:<eventId>:<recipient>`. This file is what a reader copies from, so a key
		// spelled the old way here is the collapsed-key bug shipped as an example.
		kind: "ORDER",
		title: "Su pedido va en camino",
		body: "Café El Mirador despachó su pedido PYM-2T6W9X.",
		data: { orderId: seedId(ID_PREFIXES.order, 3), status: "OUT_FOR_DELIVERY" },
		dedupeKey: `event:${seedId(ID_PREFIXES.event, 1)}:${customerIds[0]}`,
		readAt: null,
		createdAt: daysAgo(0),
	},
	{
		id: seedId(ID_PREFIXES.notification, 2),
		userId: ownerIds.get("yunta") as string,
		kind: "ORDER",
		title: "Pedido nuevo",
		body: "Jimena Salas Chacón hizo un pedido de ₡7 500.",
		data: { orderId: seedId(ID_PREFIXES.order, 6) },
		dedupeKey: `event:${seedId(ID_PREFIXES.event, 2)}:${ownerIds.get("yunta")}`,
		readAt: daysAgo(0),
		createdAt: daysAgo(1),
	},
);

payoutRows.push({
	id: seedId(ID_PREFIXES.payout, 1),
	businessId: businessIds.get("yunta") as string,
	periodStart: daysAgo(38),
	periodEnd: daysAgo(8),
	grossMinor: 486_500,
	platformFeeMinor: 48_650,
	netMinor: 437_850,
	status: "PAID",
	paidAt: daysAgo(6),
	createdAt: daysAgo(7),
});

auditRows.push({
	id: seedId(ID_PREFIXES.auditLog, 1),
	actorUserId: adminId,
	action: "business.suspend",
	targetType: "business",
	targetId: businessIds.get("cosecha") as string,
	meta: { reason: "Productos sin ficha sanitaria", previousStatus: "ACTIVE" },
	createdAt: daysAgo(5),
});

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

function quote(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

function sqlValue(value: unknown, column: Column): string {
	if (value === null || value === undefined) return "NULL";

	switch (column.dataType) {
		case "boolean":
			return value ? "1" : "0";
		case "date":
			return String(value instanceof Date ? value.getTime() : Number(value));
		case "json":
			return quote(JSON.stringify(value));
		case "number":
			return String(value as number);
		default:
			return quote(String(value));
	}
}

/**
 * Derives the column list from the table object, so a column renamed in
 * `schema.ts` cannot be silently left out of the seed — and refuses to write a
 * partial row, which would either fail the NOT NULL or, worse, quietly take the
 * column default instead of the seeded value.
 */
function insertStatement(
	table: SQLiteTable,
	rows: Record<string, unknown>[],
): string | null {
	if (rows.length === 0) return null;

	const columns = Object.entries(getTableColumns(table));
	const used = columns.filter(([property]) =>
		rows.some((row) => row[property] !== undefined),
	);

	for (const [property, column] of used) {
		if (column.notNull && rows.some((row) => row[property] === undefined)) {
			throw new Error(
				`Seed row for ${getTableName(table)} is missing the required column ${column.name}`,
			);
		}
	}

	const names = used.map(([, column]) => `\`${column.name}\``).join(", ");
	const values = rows.map(
		(row) =>
			`  (${used.map(([property, column]) => sqlValue(row[property], column)).join(", ")})`,
	);

	return `INSERT INTO \`${getTableName(table)}\` (${names}) VALUES\n${values.join(",\n")}\nON CONFLICT DO NOTHING;`;
}

const statements = [
	insertStatement(user, userRows),
	// Parents before children: `category.parentId` points at the row above it.
	insertStatement(category, categoryRows),
	insertStatement(business, businessRows),
	insertStatement(membership, membershipRows),
	insertStatement(product, productRows),
	insertStatement(productOptionGroup, optionGroupRows),
	insertStatement(productOption, optionRows),
	insertStatement(address, addressRows),
	insertStatement(cart, cartRows),
	insertStatement(cartItem, cartItemRows),
	insertStatement(promotion, promotionRows),
	insertStatement(order, orderRows),
	insertStatement(orderItem, orderItemRows),
	insertStatement(orderEvent, orderEventRows),
	insertStatement(review, reviewRows),
	insertStatement(favorite, favoriteRows),
	insertStatement(notification, notificationRows),
	insertStatement(payout, payoutRows),
	insertStatement(auditLog, auditRows),
].filter((statement): statement is string => statement !== null);

const header = [
	"-- Generated by packages/db/src/seed.ts. Do not edit by hand.",
	`-- ${userRows.length} users, ${businessRows.length} businesses, ${productRows.length} products,`,
	`-- ${orderRows.length} orders, ${orderItemRows.length} order lines, ${orderEventRows.length} order events.`,
	"-- Every row is fictional; every address is `pymeshub.test`.",
	"-- Re-running is a no-op: ids are deterministic and every insert is ON CONFLICT DO NOTHING.",
	"",
].join("\n");

const target = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"seed.sql",
);
writeFileSync(target, `${header}${statements.join("\n\n")}\n`, "utf8");

// The credentials are a second file, and the split is the guard. `db:seed` loads both into
// the local database; `db:seed:remote` loads `seed.sql` alone, so the one command that can
// reach a deployed database is the one command that cannot create a publicly-known account.
// A single file with a flag in front of it would be a guard someone can forget to respect;
// two files mean the remote command has nothing to remember.
const credentialStatements = [insertStatement(account, accountRows)].filter(
	(statement): statement is string => statement !== null,
);

const credentialsTarget = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"seed-credentials.sql",
);

const credentialsHeader = [
	"-- Generated by packages/db/src/seed.ts. Do not edit by hand.",
	`-- ${accountRows.length} sign-in credentials, one per seeded user.`,
	`-- Every one of them is the password \`${DEMO_PASSWORD}\`.`,
	"--",
	"-- This file is separate from `seed.sql` on purpose: it must never be applied to a",
	"-- deployed database. See the note above `DEMO_PASSWORD` in the seed.",
	"",
].join("\n");

writeFileSync(
	credentialsTarget,
	`${credentialsHeader}${credentialStatements.join("\n\n")}\n`,
	"utf8",
);

console.log(`Wrote ${target}`);
console.log(`Wrote ${credentialsTarget}`);
console.log(
	[
		`  users ${userRows.length}`,
		`businesses ${businessRows.length}`,
		`products ${productRows.length}`,
		`option groups ${optionGroupRows.length}`,
		`options ${optionRows.length}`,
		`carts ${cartRows.length}`,
		`orders ${orderRows.length}`,
		`order items ${orderItemRows.length}`,
		`order events ${orderEventRows.length}`,
		`reviews ${reviewRows.length}`,
		`favorites ${favoriteRows.length}`,
		`notifications ${notificationRows.length}`,
		`promotions ${promotionRows.length}`,
		`payouts ${payoutRows.length}`,
		`audit rows ${auditRows.length}`,
	].join(", "),
);
console.log(
	`  sign-in accounts ${accountRows.length}, all with the password ${DEMO_PASSWORD}`,
);
console.log("");
console.log("Apply it with:");
console.log(
	"  wrangler d1 execute pymhubdb --local -c ../../apps/api/wrangler.toml --file ./seed.sql",
);
console.log(
	"  wrangler d1 execute pymhubdb --local -c ../../apps/api/wrangler.toml --file ./seed-credentials.sql",
);
console.log("");
console.log(
	"  The second file is local-only: never pass --remote with it. `db:seed:remote`",
);
console.log(
	"  applies `seed.sql` alone, which is why the two are separate files.",
);

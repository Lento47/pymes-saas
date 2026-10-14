import { z } from "zod";

/** Only named, supported pieces of the merchant home can be customized. */
export const dashboardWidgetIdSchema = z.enum([
	"shortcuts",
	"pulse",
	"insights",
	"attention",
	"queue",
	"commands",
	"catalog",
]);
export type DashboardWidgetId = z.infer<typeof dashboardWidgetIdSchema>;
export const dashboardMetricIdSchema = z.enum([
	"net_sales",
	"orders",
	"average_order",
	"active_orders",
]);
export type DashboardMetricId = z.infer<typeof dashboardMetricIdSchema>;
export const dashboardShortcutIdSchema = z.enum([
	"orders",
	"catalog",
	"promotions",
	"analytics",
	"team",
	"payouts",
	"hours",
	"locations",
	"reviews",
]);
export type DashboardShortcutId = z.infer<typeof dashboardShortcutIdSchema>;
export const dashboardThemeIdSchema = z.enum([
	"lime",
	"amber",
	"coral",
	"sky",
	"sunset",
	"forest",
	"ocean",
	"orchid",
	"citrus",
	"berry",
	"dune",
	"harbor",
	"vine",
]);
export const dashboardLayoutsSchema = z.object({
	shortcuts: z.enum(["rail", "grid"]).default("rail"),
	pulse: z.enum(["band", "cards", "hero", "stack"]).default("band"),
	insights: z.enum(["columns", "stack"]).default("columns"),
	attention: z.enum(["list", "chips"]).default("list"),
	queue: z.enum(["rows", "compact"]).default("rows"),
	commands: z.enum(["rail", "wrap"]).default("rail"),
	catalog: z.enum(["rows", "tiles"]).default("rows"),
});
export type DashboardLayouts = z.infer<typeof dashboardLayoutsSchema>;

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetId[] = [
	"shortcuts",
	"pulse",
	"insights",
	"attention",
	"queue",
	"commands",
	"catalog",
];
/** Operational blocks remain visible even when a saved layout predates this rule. */
export const REQUIRED_DASHBOARD_WIDGETS: DashboardWidgetId[] = [
	"attention",
	"queue",
	"commands",
];
export const DEFAULT_DASHBOARD_SHORTCUTS: DashboardShortcutId[] = [
	...dashboardShortcutIdSchema.options,
];
export const DEFAULT_DASHBOARD_LAYOUTS: DashboardLayouts = {
	shortcuts: "rail",
	pulse: "band",
	insights: "columns",
	attention: "list",
	queue: "rows",
	commands: "rail",
	catalog: "rows",
};
export const dashboardCommandIdSchema = z.enum([
	"add-product",
	"promo",
	"stock",
	"hours",
	"pause",
]);
export type DashboardCommandId = z.infer<typeof dashboardCommandIdSchema>;
export const dashboardWidgetThemesSchema = z.object({
	shortcuts: dashboardThemeIdSchema.nullable().default(null),
	pulse: dashboardThemeIdSchema.nullable().default(null),
	insights: dashboardThemeIdSchema.nullable().default(null),
	attention: dashboardThemeIdSchema.nullable().default(null),
	queue: dashboardThemeIdSchema.nullable().default(null),
	commands: dashboardThemeIdSchema.nullable().default(null),
	catalog: dashboardThemeIdSchema.nullable().default(null),
});
export type DashboardWidgetThemes = z.infer<typeof dashboardWidgetThemesSchema>;
export const dashboardCommandColorsSchema = z.object({
	"add-product": dashboardThemeIdSchema.nullable().default(null),
	promo: dashboardThemeIdSchema.nullable().default(null),
	stock: dashboardThemeIdSchema.nullable().default(null),
	hours: dashboardThemeIdSchema.nullable().default(null),
	pause: dashboardThemeIdSchema.nullable().default(null),
});
export type DashboardCommandColors = z.infer<
	typeof dashboardCommandColorsSchema
>;
export const DEFAULT_DASHBOARD_WIDGET_THEMES: DashboardWidgetThemes = {
	shortcuts: null,
	pulse: null,
	insights: null,
	attention: null,
	queue: null,
	commands: null,
	catalog: null,
};
export const DEFAULT_DASHBOARD_COMMAND_COLORS: DashboardCommandColors = {
	"add-product": null,
	promo: null,
	stock: null,
	hours: null,
	pause: null,
};

export const dashboardPreferencesSchema = z.object({
	version: z.literal(1),
	widgets: z
		.array(dashboardWidgetIdSchema)
		.length(DEFAULT_DASHBOARD_WIDGETS.length)
		.refine(
			(value) => new Set(value).size === DEFAULT_DASHBOARD_WIDGETS.length,
			"Each dashboard widget must appear once",
		),
	hidden: z
		.array(dashboardWidgetIdSchema)
		.max(DEFAULT_DASHBOARD_WIDGETS.length)
		.refine(
			(value) => new Set(value).size === value.length,
			"A widget can be hidden only once",
		)
		.refine(
			(value) => value.every((id) => !REQUIRED_DASHBOARD_WIDGETS.includes(id)),
			"Operational widgets must remain visible",
		),
	metrics: z
		.array(dashboardMetricIdSchema)
		.min(1)
		.max(3)
		.refine(
			(value) => new Set(value).size === value.length,
			"Choose each metric only once",
		),
	productPreviewCount: z.union([z.literal(3), z.literal(6), z.literal(9)]),
	themeId: dashboardThemeIdSchema.nullable(),
	layouts: dashboardLayoutsSchema.default(DEFAULT_DASHBOARD_LAYOUTS),
	shortcutIds: z
		.array(dashboardShortcutIdSchema)
		.min(1)
		.max(DEFAULT_DASHBOARD_SHORTCUTS.length)
		.refine(
			(value) => new Set(value).size === value.length,
			"Choose each shortcut only once",
		)
		.default(DEFAULT_DASHBOARD_SHORTCUTS),
	widgetThemes: dashboardWidgetThemesSchema.default(
		DEFAULT_DASHBOARD_WIDGET_THEMES,
	),
	commandColors: dashboardCommandColorsSchema.default(
		DEFAULT_DASHBOARD_COMMAND_COLORS,
	),
});
export type DashboardPreferences = z.infer<typeof dashboardPreferencesSchema>;
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
	version: 1,
	widgets: [...DEFAULT_DASHBOARD_WIDGETS],
	hidden: [],
	metrics: ["net_sales", "orders", "average_order"],
	productPreviewCount: 3,
	themeId: null,
	layouts: DEFAULT_DASHBOARD_LAYOUTS,
	shortcutIds: [...DEFAULT_DASHBOARD_SHORTCUTS],
	widgetThemes: DEFAULT_DASHBOARD_WIDGET_THEMES,
	commandColors: DEFAULT_DASHBOARD_COMMAND_COLORS,
};
export const SIMPLE_DASHBOARD_PREFERENCES: DashboardPreferences = {
	...DEFAULT_DASHBOARD_PREFERENCES,
	widgets: [...DEFAULT_DASHBOARD_WIDGETS],
	hidden: ["insights", "catalog"],
	metrics: ["orders"],
	shortcutIds: ["orders", "catalog", "hours"],
	layouts: {
		shortcuts: "grid",
		pulse: "cards",
		insights: "stack",
		attention: "list",
		queue: "compact",
		commands: "wrap",
		catalog: "tiles",
	},
};

/**
 * Insert widgets a saved board does not know yet, in the default relative
 * order, so a four-block JSON from an older app still opens as a complete home.
 */
export function completeDashboardWidgets(
	saved: readonly string[],
): DashboardWidgetId[] {
	const known: DashboardWidgetId[] = [];
	for (const id of saved) {
		const parsed = dashboardWidgetIdSchema.safeParse(id);
		if (parsed.success && !known.includes(parsed.data)) known.push(parsed.data);
	}
	const missing = DEFAULT_DASHBOARD_WIDGETS.filter((id) => !known.includes(id));
	const next = [...known];
	for (const id of missing) {
		const defaultIndex = DEFAULT_DASHBOARD_WIDGETS.indexOf(id);
		let insertAt = next.length;
		for (let earlier = defaultIndex - 1; earlier >= 0; earlier -= 1) {
			const previous = DEFAULT_DASHBOARD_WIDGETS[earlier];
			if (!previous) continue;
			const at = next.indexOf(previous);
			if (at >= 0) {
				insertAt = at + 1;
				break;
			}
		}
		next.splice(insertAt, 0, id);
	}
	return next;
}

function patchThemeMap<T extends Record<string, string | null>>(
	defaults: T,
	value: unknown,
): T {
	if (!value || typeof value !== "object" || Array.isArray(value))
		return defaults;
	const next = { ...defaults };
	const raw = value as Record<string, unknown>;
	for (const key of Object.keys(defaults) as Array<keyof T>) {
		const parsed = dashboardThemeIdSchema
			.nullable()
			.safeParse(raw[String(key)]);
		if (parsed.success) next[key] = parsed.data as T[keyof T];
	}
	return next;
}

function uniqueKnown<T extends string>(
	value: unknown,
	parse: (item: unknown) => T | null,
): T[] {
	if (!Array.isArray(value)) return [];
	const next: T[] = [];
	for (const item of value) {
		const parsed = parse(item);
		if (parsed && !next.includes(parsed)) next.push(parsed);
	}
	return next;
}

/** Lift older JSON onto the current board without dropping chosen metrics. */
export function migrateDashboardPreferences(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const input = value as Record<string, unknown>;
	const widgets = completeDashboardWidgets(
		Array.isArray(input.widgets)
			? input.widgets.filter((id): id is string => typeof id === "string")
			: DEFAULT_DASHBOARD_WIDGETS,
	);
	const hidden = uniqueKnown(input.hidden, (item) => {
		const parsed = dashboardWidgetIdSchema.safeParse(item);
		return parsed.success ? parsed.data : null;
	}).filter((id) => !REQUIRED_DASHBOARD_WIDGETS.includes(id));
	const metrics = uniqueKnown(input.metrics, (item) => {
		const parsed = dashboardMetricIdSchema.safeParse(item);
		return parsed.success ? parsed.data : null;
	}).slice(0, 3);
	const shortcutIds = uniqueKnown(input.shortcutIds, (item) => {
		const parsed = dashboardShortcutIdSchema.safeParse(item);
		return parsed.success ? parsed.data : null;
	});
	const rawLayouts =
		input.layouts &&
		typeof input.layouts === "object" &&
		!Array.isArray(input.layouts)
			? (input.layouts as Record<string, unknown>)
			: {};
	const layoutPatch: Record<string, unknown> = {};
	for (const key of Object.keys(DEFAULT_DASHBOARD_LAYOUTS) as Array<
		keyof DashboardLayouts
	>) {
		const parsed = dashboardLayoutsSchema.shape[key].safeParse(rawLayouts[key]);
		if (parsed.success) layoutPatch[key] = parsed.data;
	}
	const layouts = dashboardLayoutsSchema.parse({
		...DEFAULT_DASHBOARD_LAYOUTS,
		...layoutPatch,
	});
	const widgetThemes = dashboardWidgetThemesSchema.parse(
		patchThemeMap(DEFAULT_DASHBOARD_WIDGET_THEMES, input.widgetThemes),
	);
	const commandColors = dashboardCommandColorsSchema.parse(
		patchThemeMap(DEFAULT_DASHBOARD_COMMAND_COLORS, input.commandColors),
	);
	return {
		...input,
		version: 1,
		widgets,
		hidden,
		metrics:
			metrics.length > 0 ? metrics : DEFAULT_DASHBOARD_PREFERENCES.metrics,
		layouts,
		shortcutIds:
			shortcutIds.length > 0
				? shortcutIds
				: DEFAULT_DASHBOARD_PREFERENCES.shortcutIds,
		widgetThemes,
		commandColors,
	};
}

export const shopSectionIdSchema = z.enum([
	"information",
	"offers",
	"featured",
]);
export const storefrontAppearanceSchema = z.object({
	version: z.literal(1),
	header: z.enum(["cover", "compact"]),
	accentColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.nullable(),
	sections: z
		.array(shopSectionIdSchema)
		.length(3)
		.refine(
			(value) => new Set(value).size === 3,
			"Each shop section must appear once",
		),
	hidden: z
		.array(shopSectionIdSchema)
		.max(3)
		.refine(
			(value) => new Set(value).size === value.length,
			"A section can be hidden only once",
		),
});
export type StorefrontAppearance = z.infer<typeof storefrontAppearanceSchema>;
export const DEFAULT_STOREFRONT_APPEARANCE: StorefrontAppearance = {
	version: 1,
	header: "cover",
	accentColor: null,
	sections: ["information", "offers", "featured"],
	hidden: ["offers", "featured"],
};
export const SIMPLE_STOREFRONT_APPEARANCE: StorefrontAppearance = {
	...DEFAULT_STOREFRONT_APPEARANCE,
	header: "compact",
	sections: [...DEFAULT_STOREFRONT_APPEARANCE.sections],
	hidden: ["offers", "featured"],
};

/** Tolerate settings written by an older or newer app without hiding required content. */
export function resolveDashboardPreferences(
	value: unknown,
): DashboardPreferences {
	const parsed = dashboardPreferencesSchema.safeParse(
		migrateDashboardPreferences(value),
	);
	return parsed.success ? parsed.data : DEFAULT_DASHBOARD_PREFERENCES;
}

/** Accept a saved board, including four-widget JSON, and store the current shape. */
export const dashboardPreferencesInputSchema = z.preprocess(
	migrateDashboardPreferences,
	dashboardPreferencesSchema,
);

export function resolveStorefrontAppearance(
	value: unknown,
): StorefrontAppearance {
	const parsed = storefrontAppearanceSchema.safeParse(value);
	return parsed.success ? parsed.data : DEFAULT_STOREFRONT_APPEARANCE;
}

function luminance(hex: string): number {
	const channel = (start: number) => {
		const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(first: string, second: string): number {
	const a = luminance(first);
	const b = luminance(second);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// apps/mobile/theme/tokens.ts uses #FEFDFA for the customer light page; the
// other light pages are white. #111111 is conservative for the dark pages.
const LIGHT_SHOP_SURFACE = "#FEFDFA";
const DARK_SHOP_SURFACE = "#111111";

/** One accent must remain visible on both mobile-shop page surfaces. */
export function brandAccentCheck(value: string): {
	valid: boolean;
	suggested: string | null;
	ink: "#000000" | "#FFFFFF";
} {
	if (!/^#[0-9A-Fa-f]{6}$/.test(value))
		return { valid: false, suggested: null, ink: "#000000" };
	const hex = value.toUpperCase();
	const ink = ratio(hex, "#000000") >= 4.5 ? "#000000" : "#FFFFFF";
	const valid =
		ratio(hex, LIGHT_SHOP_SURFACE) >= 3 &&
		ratio(hex, "#FFFFFF") >= 3 &&
		ratio(hex, DARK_SHOP_SURFACE) >= 3 &&
		ratio(hex, ink) >= 4.5;
	if (valid) return { valid: true, suggested: null, ink };
	const rgb = [1, 3, 5].map((index) =>
		Number.parseInt(hex.slice(index, index + 2), 16),
	);
	let suggested = "#777777";
	let distance = Number.POSITIVE_INFINITY;
	for (const target of [0, 255]) {
		for (let step = 0; step <= 255; step += 1) {
			const fraction = step / 255;
			const candidate = `#${rgb
				.map((channel) =>
					Math.round(channel + (target - channel) * fraction)
						.toString(16)
						.padStart(2, "0"),
				)
				.join("")}`.toUpperCase();
			if (
				ratio(candidate, LIGHT_SHOP_SURFACE) < 3 ||
				ratio(candidate, "#FFFFFF") < 3 ||
				ratio(candidate, DARK_SHOP_SURFACE) < 3
			)
				continue;
			if (fraction < distance) {
				distance = fraction;
				suggested = candidate;
			}
			break;
		}
	}
	return { valid: false, suggested, ink };
}

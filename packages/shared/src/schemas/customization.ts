import { z } from "zod";

/** Only named, supported pieces of the merchant home can be customized. */
export const dashboardWidgetIdSchema = z.enum([
	"shortcuts",
	"pulse",
	"insights",
	"catalog",
]);
export const dashboardMetricIdSchema = z.enum([
	"net_sales",
	"orders",
	"average_order",
	"active_orders",
]);
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
export const dashboardPreferencesSchema = z.object({
	version: z.literal(1),
	widgets: z
		.array(dashboardWidgetIdSchema)
		.length(4)
		.refine(
			(value) => new Set(value).size === 4,
			"Each dashboard widget must appear once",
		),
	hidden: z
		.array(dashboardWidgetIdSchema)
		.max(4)
		.refine(
			(value) => new Set(value).size === value.length,
			"A widget can be hidden only once",
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
});
export type DashboardPreferences = z.infer<typeof dashboardPreferencesSchema>;
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
	version: 1,
	widgets: ["shortcuts", "pulse", "insights", "catalog"],
	hidden: [],
	metrics: ["net_sales", "orders", "average_order"],
	productPreviewCount: 3,
	themeId: null,
};

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

/** Tolerate settings written by a newer app without hiding required content. */
export function resolveDashboardPreferences(
	value: unknown,
): DashboardPreferences {
	const parsed = dashboardPreferencesSchema.safeParse(value);
	return parsed.success ? parsed.data : DEFAULT_DASHBOARD_PREFERENCES;
}

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

/** One accent must remain visible on both neutral mobile-shop surfaces. */
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
		ratio(hex, "#FFFFFF") >= 3 &&
		ratio(hex, "#111111") >= 3 &&
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
			if (ratio(candidate, "#FFFFFF") < 3 || ratio(candidate, "#111111") < 3)
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

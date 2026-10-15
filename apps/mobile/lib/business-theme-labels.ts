import type { MessageKey } from "@pymeshub/i18n";
import type { BusinessThemeId } from "@/theme/business-theme-ids";

/** Shared, localized names for every built-in merchant palette. */
export const THEME_LABEL = {
	lime: "biz.theme.lime",
	amber: "biz.theme.amber",
	coral: "biz.theme.coral",
	sky: "biz.theme.sky",
	sunset: "biz.theme.sunset",
	forest: "biz.theme.forest",
	ocean: "biz.theme.ocean",
	orchid: "biz.theme.orchid",
	citrus: "biz.theme.citrus",
	berry: "biz.theme.berry",
	dune: "biz.theme.dune",
	harbor: "biz.theme.harbor",
	vine: "biz.theme.vine",
} as const satisfies Record<BusinessThemeId, MessageKey>;

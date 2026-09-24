import type { MessageKey } from "@pymeshub/i18n";
import type { BusinessListInput } from "@pymeshub/shared";
import { StyleSheet, View } from "react-native";

import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { ActionBar } from "./action-bar";
import { Button } from "./button";
import { Segmented } from "./segmented";
import { Sheet } from "./sheet";
import { Text } from "./text";

/**
 * The shop filters, in a sheet.
 *
 * ## Every control here is one the API honours
 *
 * This is the rule the file exists to keep: a control that does nothing is a lie. So the
 * sheet is built from `businessListInput` in `packages/shared/src/schemas/business.ts`, and
 * `apps/api/src/services/businesses.ts` was read to confirm each one actually reaches the
 * query rather than merely being accepted by the schema:
 *
 * - `openNow` → `if (input.openNow && !card.isOpen) continue;`
 * - `deliveryOnly` → `conditions.push(eq(businessTable.deliveryEnabled, true))`
 * - `radiusKm` → the haversine circle, `if (distanceKm > input.radiusKm) continue;`
 * - `sort` → `sortValueOf`, whose enum holds every sort this UI can offer, `best` among them
 *
 * `products.list` takes `minPriceMinor`, `maxPriceMinor`, `featuredOnly` and
 * `sortDirection` and the API honours them too, but discovery has no screen that lists
 * products as a set — search's product section is a result list under a query — so they are
 * not exposed here. A price control that silently applied to nothing would be the same lie.
 *
 * ## The two controls that are withheld, and why withholding is the honest move
 *
 * `radiusKm` only narrows a list when the caller sent a coordinate: the service builds a
 * bounding box from `lat`/`lng` and there is nothing to build one from otherwise, so a
 * radius chosen on a phone without a fix is accepted and discarded. `sort: "distance"` has
 * the same hole from the other side — `sortValueOf` returns `distanceKm ?? row.ratingAvg`,
 * so with no origin "nearest" quietly becomes "best rated". A segment labelled "Más
 * cercanos" over a list sorted by rating is a false statement about the order of what the
 * customer is looking at.
 *
 * `effectiveBusinessFilters` is the fix for both: it is the one place that decides what the
 * request is allowed to say, and the sheet, the badge and the footer summary all read it, so
 * the control, the count and the request cannot disagree. Without a fix the radius control
 * is not drawn (replaced by a sentence saying why, which is a fact rather than an absence)
 * and the distance segment is not offered.
 *
 * ## Why the shapes differ between the three groups
 *
 * `Segmented` no longer cuts a word — its labels wrap and the whole group grows, so the
 * truncated-segment argument that once separated these shapes is gone. The reason that
 * survives is what wrapping does to the row. The radius is three numbers ("1 km", "5 km",
 * "10 km") that stay on one line at every text scale down to a 320pt screen, so the group
 * stays the one-line row of equal segments `Segmented` is for. The sort is four Spanish
 * phrases ("Mejor valorados"), and at 200% those wrap a segment into several lines —
 * legible, but a control whose height rides the reader's text scale. So the sort is
 * `Button`s, which wrap their label and stack as a radio list, where a tall option is just
 * a taller row. The shape follows the words; whether the sort group should rejoin
 * `Segmented` now that it wraps is a design call, not something this docblock settles by
 * asserting a cap `Segmented` no longer has.
 *
 * The radius is three options rather than four for that same measured reason: a fourth
 * segment drops the per-segment room from ~90pt to ~62pt on a 375pt screen, which is enough
 * for "10 km" at 1× and not enough at 200%, where the alternative gives it ~90pt and it fits.
 *
 * ## The footer is an `ActionBar`, and it is the only place in discovery that earns one
 *
 * `ActionBar` owns its own bottom inset, and a `Sheet`'s footer deliberately pays none
 * (`sheet.tsx`'s `footer` is `paddingTop: space.md` and nothing else), so the bar's inset is
 * paid exactly once, by the one component that knows about the home indicator. Its summary
 * is the same list of effective filters the badge counts, in words, for the reason
 * `docs/design-mobile.md` gives: never hide the total behind a tap. There is no "apply"
 * step — the list behind the sheet is already filtered, because the state lives in the
 * screen — so the one action is "Listo", and calling it "Aplicar" would promise a write that
 * already happened.
 */

/**
 * The sorts this UI offers, in the order the controls draw them.
 *
 * Spelled out rather than inferred so `SORT_LABELS` below is indexed by a closed set, and
 * `satisfies` so a name that is not in `businessListInput` is a compile error rather than a
 * request the API rejects. All five are here, so an option is never a request the server
 * cannot honour — and `best` leads because it is the default ordering: a customer who has
 * chosen nothing sees it selected, and the list under it is the marketplace's own ranking
 * rather than one rule picked out of five.
 */
export const BUSINESS_SORTS = [
	"best",
	"distance",
	"rating",
	"popular",
	"newest",
] as const satisfies readonly BusinessListInput["sort"][];

export type BusinessSort = (typeof BUSINESS_SORTS)[number];

/**
 * The five sorts, in words.
 *
 * Exported, because `app/nearby.tsx` draws the same options in an inline `Segmented` beside
 * this sheet's radio group and used to hold a second copy of this table — two mappings of one
 * enum onto one set of keys, kept in step by nothing but the compiler, which checks the key
 * and not the choice. One table read by both controls is what makes the segment and the radio
 * for `rating` impossible to label differently.
 */
export const SORT_LABELS: Record<BusinessSort, MessageKey> = {
	best: "discovery.sort.best",
	distance: "discovery.sort.distance",
	rating: "discovery.sort.rating",
	popular: "discovery.sort.popular",
	newest: "discovery.sort.newest",
};

/** `businessListInput.radiusKm`'s own default (10, range 0.5–80). */
export const DEFAULT_RADIUS_KM = 10;

/**
 * The radii offered, in kilometres, ascending.
 *
 * Three, and only three: walkable, close, and "the whole city". The input accepts any value
 * between 0.5 and 80, so this is a choice about what a person actually picks between, not a
 * limit of the API — and see the note above on why a fourth segment stops fitting at 200%.
 */
const RADIUS_OPTIONS_KM = [1, 5, 10] as const;

export type BusinessFilters = {
	openNow: boolean;
	deliveryOnly: boolean;
	radiusKm: number;
	sort: BusinessSort;
};

/**
 * The defaults this screen starts from: nothing narrowing, and ranked by the marketplace.
 *
 * The three filters match `businessListInput`'s, so "nothing chosen" and "the server's own
 * behaviour" are one state rather than two that happen to agree today — a radius or a flag
 * that differed would make the badge read "Filtros · 1" on a list nobody had filtered.
 *
 * `sort` is the one that differs, and deliberately: the API's default is `distance` because
 * that is what a shipped build already sends by name and a list that reorders under a screen
 * nobody re-tested is how a sort change becomes a bug report. This app ships with the new
 * ordering and asks for it, which is the whole point of the sort existing — and the badge
 * counts against this same value through `effectiveDefaults`, so "Recomendados" selected is
 * not counted as a filter the customer chose.
 */
export const DEFAULT_BUSINESS_FILTERS: BusinessFilters = {
	openNow: false,
	deliveryOnly: false,
	radiusKm: DEFAULT_RADIUS_KM,
	sort: "best",
};

/**
 * What the request is allowed to say, given what the phone knows.
 *
 * The single source for the two degradations the API performs silently: no coordinate means
 * no radius and no distance ordering. Every reader of the filter state goes through here —
 * the request the screen sends, the badge on the button, the footer summary and the
 * selected radio — so none of them can hold a different opinion from the query.
 */
export function effectiveBusinessFilters(
	filters: BusinessFilters,
	hasLocation: boolean,
): BusinessFilters {
	if (hasLocation) return filters;
	return {
		...filters,
		// Sent as the default rather than dropped, so the request always carries a complete
		// filter set and the server never falls back to a value the badge is not counting.
		radiusKm: DEFAULT_RADIUS_KM,
		// The service sorts by `ratingAvg` when it has no distance, so "rating" is the truth
		// about what the list is doing — and it is the same rows, in the same order, that
		// "distance" would have produced.
		sort: filters.sort === "distance" ? "rating" : filters.sort,
	};
}

/**
 * The effective set with nothing chosen — the baseline the two readers below compare against.
 *
 * `DEFAULT_BUSINESS_FILTERS` put through the same degradation as the customer's own filters,
 * and that is the whole of it: a comparison against the raw constant is a comparison between
 * two different questions. Without a fix, `effectiveBusinessFilters` rewrites the sort from
 * "distance" to "rating" (above), so the raw default — which is "distance" — differs from an
 * untouched effective set, and every phone without a location counted and printed a sort its
 * owner had never chosen.
 *
 * `app/nearby.tsx` reads the count to decide whether an empty result is the filters' doing, so
 * the symptom was not only a badge reading "Filtros · 1" over an unfiltered list: a customer
 * with nothing genuinely nearby was shown the "your filters emptied this" state with a "Quitar
 * filtros" action, for a filter that was never set.
 */
export function effectiveDefaults(hasLocation: boolean): BusinessFilters {
	return effectiveBusinessFilters(DEFAULT_BUSINESS_FILTERS, hasLocation);
}

/**
 * How many of the filters are actually narrowing the list.
 *
 * Counted from the effective set and not the chosen one, which is the difference between a
 * badge that reads "Filtros · 1" over an unfiltered list and one that reads "Filtros" —
 * a radius left over from a phone that has since lost its fix narrows nothing, so it is not
 * counted. Both sides of every comparison come from a `hasLocation` that is the same on both,
 * so the baseline itself is effective too; see `effectiveDefaults` for what went wrong without
 * it. The count is a count of filters, not of nouns, so it is read with `t` and never `tp`;
 * `discovery.filters.button.active` has no `_plural` sibling on purpose.
 */
export function activeFilterCount(
	filters: BusinessFilters,
	hasLocation: boolean,
): number {
	const effective = effectiveBusinessFilters(filters, hasLocation);
	const base = effectiveDefaults(hasLocation);
	return (
		(effective.openNow ? 1 : 0) +
		(effective.deliveryOnly ? 1 : 0) +
		(effective.radiusKm !== base.radiusKm ? 1 : 0) +
		(effective.sort !== base.sort ? 1 : 0)
	);
}

export function FilterSheet({
	open,
	onClose,
	filters,
	onChange,
	hasLocation,
}: {
	open: boolean;
	onClose: () => void;
	filters: BusinessFilters;
	onChange: (filters: BusinessFilters) => void;
	/**
	 * Whether `useDeviceLocation()` has a fix. Not the coordinate: this sheet never uses the
	 * numbers, it only decides what the API can be asked for.
	 */
	hasLocation: boolean;
}) {
	const { t } = useT();

	const effective = effectiveBusinessFilters(filters, hasLocation);
	const base = effectiveDefaults(hasLocation);
	const active = activeFilterCount(filters, hasLocation);

	const radiusOptions = RADIUS_OPTIONS_KM.map((km) => ({
		value: String(km),
		label: t("unit.km", { value: km }),
	}));

	// Five with a fix, four without — `effective.sort` is never "distance" in the second
	// case, so no chosen value is ever dropped from the group it is rendered in.
	const sortOptions = BUSINESS_SORTS.filter(
		(sort) => hasLocation || sort !== "distance",
	);

	// What the list behind the sheet is doing, in words. Built from the effective set, the
	// same one the request uses, so the footer cannot describe a filter the query ignored — and
	// compared against the effective defaults for the same reason the badge is: the two sit on
	// one sheet, and a footer naming "Rating" under a badge counting nothing is the sheet
	// contradicting itself. See `effectiveDefaults`.
	const summary =
		[
			effective.openNow ? t("discovery.filters.openNow") : null,
			effective.deliveryOnly ? t("discovery.filters.deliveryOnly") : null,
			effective.radiusKm !== base.radiusKm
				? t("unit.km", { value: effective.radiusKm })
				: null,
			effective.sort !== base.sort ? t(SORT_LABELS[effective.sort]) : null,
		]
			.filter((part): part is string => part !== null)
			// The sentence for "nothing is narrowing this list" rather than an empty line, which
			// would read as a loading state.
			.join(" · ") || t("discovery.filters.none");

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={t("discovery.filters.title")}
			closeLabel={t("action.close")}
			// One full-height snap. `Sheet` is content-sized — `bottom: 0`, no height — and it
			// resolves a fraction against the panel's own height:
			//
			//     Math.max(0, height * (1 - fraction) - (height - panelHeight))
			//
			// which is the distance from where the fraction says the panel's top edge belongs
			// to where `bottom: 0` already put it. At `1` that distance is negative for every
			// panel shorter than the screen, so the clamp at 0 leaves the panel exactly where it
			// is drawn; below `1` it turns into a real push once the panel is taller than that
			// share of the screen, which parks the bottom of the panel — the last rows and the
			// footer's action — past the bottom edge with nothing left to bring them back.
			// `maxHeight` (screen − top inset − `space.lg`) is what actually stops the panel
			// growing past the screen.
			snapPoints={[1]}
			footer={
				<ActionBar
					docked
					summary={
						<Text variant="label" tone="muted">
							{summary}
						</Text>
					}
					primary={{ label: t("discovery.filters.done"), onPress: onClose }}
				/>
			}
		>
			<View style={styles.group}>
				{/* Two toggles, not a radio pair: they are independent facts about a shop and
				    either, both or neither can be on. `choiceRole="checkbox"` is what tells a
				    screen reader that — a radio there would promise that choosing one unchose
				    the other, which is the opposite of the rule they are under. */}
				<Button
					label={t("discovery.filters.openNow")}
					variant="secondary"
					size="sm"
					fullWidth
					selected={filters.openNow}
					choiceRole="checkbox"
					onPress={() => {
						selection();
						onChange({ ...filters, openNow: !filters.openNow });
					}}
				/>
				<Button
					label={t("discovery.filters.deliveryOnly")}
					variant="secondary"
					size="sm"
					fullWidth
					selected={filters.deliveryOnly}
					choiceRole="checkbox"
					onPress={() => {
						selection();
						onChange({ ...filters, deliveryOnly: !filters.deliveryOnly });
					}}
				/>
			</View>

			<View style={styles.group}>
				<FieldLabel>{t("discovery.filters.distance")}</FieldLabel>
				{hasLocation ? (
					<Segmented
						label={t("discovery.filters.distance")}
						options={radiusOptions}
						value={String(filters.radiusKm)}
						onChange={(value) =>
							onChange({ ...filters, radiusKm: Number(value) })
						}
					/>
				) : (
					// The control is withheld rather than drawn inert, and the sentence says
					// which fact is missing. A greyed-out segment row would leave the reader
					// guessing whether the app was broken or they were.
					<Text variant="caption" tone="muted">
						{t("discovery.filters.distance.noLocation")}
					</Text>
				)}
			</View>

			<View
				style={styles.group}
				accessibilityRole="radiogroup"
				accessibilityLabel={t("discovery.filters.sort")}
			>
				<FieldLabel>{t("discovery.filters.sort")}</FieldLabel>
				<View style={styles.choices}>
					{sortOptions.map((sort) => (
						<Button
							key={sort}
							label={t(SORT_LABELS[sort])}
							variant="secondary"
							size="sm"
							fullWidth
							selected={effective.sort === sort}
							// The default: one of a set. `selected` draws the tick and sets
							// `accessibilityState.checked`, so the state is a mark and a word,
							// never only the fill.
							choiceRole="radio"
							onPress={() => {
								selection();
								onChange({ ...filters, sort });
							}}
						/>
					))}
				</View>
			</View>

			{/* Present only when there is something to clear. A permanently visible "Quitar
			    filtros" over an unfiltered list is a control with nothing to do. */}
			{active > 0 ? (
				<Button
					label={t("discovery.filters.clear")}
					variant="ghost"
					size="sm"
					fullWidth
					onPress={() => {
						selection();
						onChange(DEFAULT_BUSINESS_FILTERS);
					}}
				/>
			) : null}
		</Sheet>
	);
}

/**
 * A group's visible name, hidden from the accessibility tree.
 *
 * Each group already carries the same words as its own label — `Segmented`'s `label` prop,
 * the sort group's `accessibilityLabel` — so leaving this text in the tree would read
 * "Ordenar por" and then "Ordenar por, radiogroup" to somebody using a screen reader. The
 * words stay on screen because a sighted reader needs them, and they are marked decorative
 * for the same reason a card's logo is: the thing beside it already says it out loud.
 */
function FieldLabel({ children }: { children: string }) {
	return (
		<Text
			variant="label"
			bold
			tone="muted"
			accessibilityElementsHidden
			importantForAccessibility="no"
		>
			{children}
		</Text>
	);
}

const styles = StyleSheet.create({
	// `md` between groups and `xs` inside one — the grouping is the whole signal that the
	// radio list under "Ordenar por" belongs to it.
	group: { gap: space.sm, marginBottom: space.md },
	choices: { gap: space.xs },
});

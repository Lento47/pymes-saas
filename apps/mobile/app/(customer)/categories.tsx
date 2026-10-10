import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { CategoryGrid } from "@/components/category-grid";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Screen } from "@/components/screen";
import { useSkeletonHold } from "@/components/skeleton";
import { CategoryGridSkeleton } from "@/components/skeletons";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { space } from "@/theme";

/**
 * Everything the marketplace sells, as a grid.
 *
 * The app's only taxonomy surface was the chip rail — a row that scrolls sideways, which shows
 * the *first* six categories and hides the rest behind a gesture nobody is told about. A shop's
 * products are browsable and a category is browsable, but "what does this marketplace sell" had
 * no page: the rail is a shortcut, and a shortcut is not an index. This is the index.
 *
 * `catalog.categories` is the whole of the data and it is not new: the home feed's rail and the
 * search tab's idle state already read the same query, so the screen costs no endpoint and is
 * usually served from the cache the feed filled a tap earlier. The API orders it `sortOrder`
 * then `name` (`apps/api/src/services/catalog.ts`), which is the order a grid wants anyway —
 * the rail's order, at a size that can be scanned instead of swiped.
 *
 * ## It is a route, not a tab
 *
 * There are no tabs: home is the app and everything else pushes over it. A
 * category is somewhere the reader *went*, the same as `app/category/[slug]`,
 * which is why this pushes onto the stack from the feed's
 * own category heading and comes back to it.
 *
 * ## Why the entry is a heading and not the rail's own chip
 *
 * The rail already ends in `category.all`, and that chip goes to `/nearby` — "every business",
 * which is a different job from "every category". The heading above the rail carries the way in
 * instead, as a `SectionHeader` action the way `home.featured`'s "Ver todo" does, and it is
 * drawn only when there are categories to see: a link over an empty set is a link to a page
 * that says nothing.
 *
 * ## Two up, and the same two the product shelf uses
 *
 * `lib/chunk-pairs` builds the rows, so this grid and `app/featured`'s cannot disagree about
 * what half a row is — including the lone trailing tile, which keeps its half-width instead of
 * stretching across the screen. The gutter, the gap and the half-width cell are `app/featured`'s
 * own numbers, restated here and in `./skeletons`' `gridStyles` the way that file already
 * restates them, because the wait and the content have to be the same shape.
 *
 * ## What the tile says, and what it does not
 *
 * It draws the category's name, its glyph and `store.category.count` — an **existing** plural
 * pair, `{count} producto` / `{count} productos`, which the storefront's own category header
 * already uses for the same number. `productCount` is optional on `categorySchema`, so a row
 * without one draws the name alone rather than a sentence about a number it does not have.
 *
 * `iconName` arrives as a bare string from an admin's free-text field, so the glyph goes
 * through `lib/category-icon` — the lookup, the fallback and the `__DEV__` warning the rail
 * reads too. It is the same module and not a second copy, which is the whole reason it is one.
 *
 * No `accessibilityHint`, and that is `./product-tile`'s decision rather than an omission: the
 * label names the category and its count, the role is already `button`, and no landed key names
 * what a category tap opens — so a hint here would be either the obvious half of what has just
 * been read, or a key invented outside the file that owns the dictionary (Rule 8).
 *
 * No haptic either. `selection()` belongs to a picker settling, and a tap that opens a page is
 * answered by the page — `./category-rail` draws the same line for the same tap.
 */
export default function Categories() {
	const trpc = useTRPC();
	const { t } = useT();

	const categories = useQuery(trpc.catalog.categories.queryOptions());
	const waiting = useSkeletonHold(categories.isPending);

	// The filter is the whole of this screen's honesty about the taxonomy. `catalog.categories`
	// returns both levels — 18 sectors and their 224 children — and an index of 242 tiles two up
	// is 121 rows with the second level indistinguishable from the first. The index draws the
	// first level; a sector's tiles are on that sector's own page (`app/category/[slug]`), which
	// is where its tile leads and where the rail's chips lead too.
	const items = categories.data ?? [];
	const sectors = useMemo(
		() => items.filter((entry) => entry.parentId === null),
		[items],
	);

	return (
		// `padded={false}` and its own gutter: the grid is the screen, and the wait that stands
		// in for it carries the same gutter rather than a second one.
		<Screen
			title={t("search.categories")}
			leading={<BackButton to="/" />}
			padded={false}
			scroll
			contentStyle={styles.page}
		>
			{categories.isError ? (
				<View style={styles.pad}>
					<ErrorState
						error={categories.error}
						onRetry={() => void categories.refetch()}
					/>
				</View>
			) : waiting || !categories.data ? (
				<CategoryGridSkeleton />
			) : items.length === 0 ? (
				<View style={styles.pad}>
					{/* `home.nearby.empty.all` — "Todavía no hay negocios publicados" — and not a
					    sentence written here. An empty taxonomy is not "no results for a filter":
					    it is a marketplace with nothing published, which is the state that key
					    already names, and Rule 8 means no lane writes the sentence that would
					    replace it. The screen is unreachable from the app while it is empty (the
					    heading that opens it is drawn only over a non-empty set), so this is the
					    deep-link and the first-load case. */}
					<EmptyState icon="grid-outline" title={t("home.nearby.empty.all")} />
				</View>
			) : (
				<CategoryGrid items={sectors} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	page: { gap: space.lg },
	pad: { paddingHorizontal: space.lg },
});

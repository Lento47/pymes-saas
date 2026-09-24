import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AnimateIn } from "@/components/animate-in";
import { BusinessCard } from "@/components/business-card";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ListEnd } from "@/components/list-end";
import { ProductRow } from "@/components/product-row";
import { Screen } from "@/components/screen";
import { SectionHeader } from "@/components/section-header";
import { useSkeletonHold } from "@/components/skeleton";
import {
	BusinessCardsSkeleton,
	ProductRowsSkeleton,
} from "@/components/skeletons";
import { useSession } from "@/lib/auth/session";
import { useFavorites } from "@/lib/favorites";
import { useT } from "@/lib/i18n";
import { radius, space } from "@/theme";

/**
 * Everything this customer has hearted, in the two groups the API keeps them in.
 *
 * The heart shipped before this screen did, which made it a control that took a write and
 * returned nothing: a customer could save a shop from the feed, scroll away, and have no way
 * back to it except to find the shop again. `@/lib/favorites` had the list the whole time —
 * `favorites.list` is the cache every heart on every card reads its state from — and the only
 * thing missing was a screen that draws it.
 *
 * ## The two groups are two lists, and they end twice
 *
 * `Favorites` is `{ businesses, products }` (`@/lib/favorites`), and a shop and a dish are
 * different objects with different cards: `./business-card` is a surface with a logo, a
 * status and a chip row, `./product-row` is a line with a thumbnail and a price. Drawing them
 * as one list would mean one of the two wearing the other's shape. So they are two sections,
 * each with its own name, and — Rule 8 — each **ending** with `./list-end`.
 *
 * ## `ListEnd` here has no next page, and that is the point of using it anyway
 *
 * `catalog.listFavorites` answers with the whole set: two arrays, no cursor
 * (`apps/api/src/routers/favorites.ts:19`). So `hasNextPage` is `false` and the button
 * `./list-end` draws for a next page is unreachable — the `onPress` it still requires is a
 * function that cannot be called, which is why it is one module constant rather than a fresh
 * arrow at each of the two call sites. What this screen is actually buying from the primitive
 * is the **end statement**: "No hay más que mostrar" is one sentence in one place, and a
 * heading over a group that has no foot reads as a list that failed to finish loading. The
 * primitive also returns `null` at `rows === 0` by itself, which is what lets the waiting
 * branch below pass `count={0}` and get a real heading with no foot under it.
 *
 * ## `./section-header`, not `ScreenSection`
 *
 * `ScreenSection` is a box: it carries its own top margin and it wraps its children, so the
 * rows inside it would be inset twice — once by the screen's gutter and once by the box's own
 * — and a `./product-row`'s divider would stop at the wrapper's edge instead of reaching the
 * screen's. `./section-header` is the heading alone, which is what a block that owns its own
 * horizontal padding needs, and it is the same pair `app/index.tsx` uses for the same
 * reason on the same two shapes.
 *
 * ## No way out is drawn, and that is `app/addresses.tsx`'s decision rather than an omission
 *
 * The stack header is off app-wide (`app/_layout.tsx`), so a pushed screen owns its own back
 * control — and this screen does not draw one, which puts it with `app/addresses.tsx`,
 * `app/cart.tsx` and `app/business.tsx` rather than with `app/featured.tsx` and
 * `app/nearby.tsx`. The platform's own way out is real on both: the Android back key and the
 * iOS edge swipe both work on a pushed native-stack screen. A ghost "Volver" under the title
 * would be a second control for a gesture the reader already has, and on the screen reached
 * by tapping a heart in the feed the stack behind it is always the feed.
 *
 * ## What this screen does not offer
 *
 * No way to empty it in one tap and no way to remove a row by swiping: the heart on every
 * card is the control that removes one, it is already on every card this screen draws
 * (`./business-card` pins one; a `./product-row` is hearted from the product screen), and it
 * writes through the same cache this list is read from — so a shop un-hearted from here is
 * gone from here in the same frame. A second removal control would be a second path to one
 * fact.
 *
 * ## The ladder, which is `app/account.tsx`'s
 *
 * Skeleton while the session or the read is outstanding, a sign-in prompt when there is
 * nobody to have favourites, `./error-state` when the read failed, one empty state when the
 * account has saved nothing, and the list. Nothing is drawn underneath the skeleton or under
 * a failure, for the reason that file gives: a section appearing in the window where the
 * skeleton is still held up is the skeleton and the content disagreeing about what is on
 * screen.
 */
export default function FavoritesScreen() {
	const { t } = useT();
	const { status } = useSession();
	const { list } = useFavorites();

	const signedIn = status === "signed-in";
	const waiting = useSkeletonHold(
		status === "loading" || (signedIn && list.isPending),
	);

	// The real headings are drawn during the wait, because both are static copy rather than
	// data — so the shape the skeleton is standing in for is the shape that lands, and the two
	// names do not appear at the moment the data does.
	if (waiting) {
		return (
			<Screen title={t("favorites.title")} padded={false} scroll>
				<Section title={t("favorites.businesses")} count={0}>
					<BusinessCardsSkeleton />
				</Section>
				<Section title={t("favorites.products")} count={0}>
					<ProductRowsSkeleton />
				</Section>
			</Screen>
		);
	}

	// Signed out, this is a screen with nothing to read rather than a screen with nothing
	// saved, and the two are worth telling apart: `favorites.list` is a `protectedProcedure`,
	// so an account is the one thing that would fill it. Same pair of controls the account tab
	// offers for the same reason.
	if (!signedIn) {
		return (
			<Screen title={t("favorites.title")} scroll>
				<EmptyState
					icon="heart-outline"
					title={t("auth.signIn.title")}
					body={t("auth.signIn.subtitle")}
					actionLabel={t("action.signIn")}
					onAction={() => router.push("/sign-in")}
				/>
				<Button
					label={t("action.signUp")}
					onPress={() => router.push("/sign-up")}
					variant="ghost"
					fullWidth
					style={styles.secondAction}
				/>
			</Screen>
		);
	}

	if (list.isError) {
		return (
			<Screen title={t("favorites.title")} scroll>
				<ErrorState error={list.error} onRetry={() => void list.refetch()} />
			</Screen>
		);
	}

	const businesses = list.data?.businesses ?? [];
	const products = list.data?.products ?? [];

	if (businesses.length === 0 && products.length === 0) {
		return (
			<Screen title={t("favorites.title")} scroll>
				<EmptyState
					icon="heart-outline"
					title={t("favorites.empty.title")}
					body={t("favorites.empty.body")}
				/>
			</Screen>
		);
	}

	return (
		<Screen
			title={t("favorites.title")}
			padded={false}
			scroll
			// Rule 6, and this list is the case for it: a shop can close, a dish can sell out,
			// and the only thing on this screen that says so is a card that was read once.
			onRefresh={() => list.refetch()}
		>
			{/* Each group is drawn only when it has something in it. A heading over an empty
			    group is a name with a hole under it — `app/account.tsx` deleted its own
			    version of that mistake — and the all-empty case is the state above this one, so
			    a screen that reaches here has at least one group to draw. */}
			{businesses.length > 0 ? (
				<Section title={t("favorites.businesses")} count={businesses.length}>
					<View style={styles.cards}>
						{businesses.map((business, index) => (
							<AnimateIn key={business.id} index={index}>
								<BusinessCard
									business={business}
									onPress={() =>
										router.push({
											pathname: "/store/[slug]",
											params: { slug: business.slug },
										})
									}
								/>
							</AnimateIn>
						))}
					</View>
				</Section>
			) : null}

			{products.length > 0 ? (
				<Section title={t("favorites.products")} count={products.length}>
					{/* The rows are a box with its own gutters and its own clip, exactly as the
					    feed draws them: `./product-row` is edge-to-edge inside `space.lg` and
					    carries a bottom hairline, so a row the screen inset a second time would
					    have a divider starting and stopping in the middle of nothing. */}
					<View style={styles.rows}>
						{products.map((product, index) => (
							<AnimateIn key={product.id} index={index}>
								<ProductRow
									product={product}
									// The one list in the app where the seller line is not optional:
									// this shelf holds dishes from different shops, and a name with
									// no shop on it is a dish the reader cannot place.
									showSeller
									onPress={() =>
										router.push({
											pathname: "/product/[id]",
											params: { id: product.id },
										})
									}
								/>
							</AnimateIn>
						))}
					</View>
				</Section>
			) : null}
		</Screen>
	);
}

/**
 * `./list-end`'s `onPress` for a list that has no next page.
 *
 * `hasNextPage` is `false` on this screen — `favorites.list` returns the whole set, not a page
 * of it — so the button that would call this is never drawn. It is one constant rather than
 * two arrows so that the unreachable branch is visibly the same branch twice.
 */
const NO_MORE_PAGES = () => {};

/**
 * One named group of saved things: its heading, its rows, and the line that ends it.
 *
 * The heading is outside the children rather than around them, which is the whole reason this
 * is `./section-header` and not `ScreenSection` — see the file docblock. `count` is the row
 * count `./list-end` guards on, and `0` is how the waiting branch above asks for a heading
 * with no foot under it, because that primitive answers `0` with `null` itself.
 */
function Section({
	title,
	count,
	children,
}: {
	title: string;
	count: number;
	children: React.ReactNode;
}) {
	return (
		<View style={styles.section}>
			<View style={styles.pad}>
				<SectionHeader title={title} />
			</View>
			{children}
			<ListEnd
				rows={count}
				hasNextPage={false}
				loading={false}
				onPress={NO_MORE_PAGES}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	// `ScreenSection`'s own top margin, in the open — the same number `app/index.tsx`
	// pays between its sections, because a group on this screen is a group on that one.
	section: { marginTop: space.xxl },
	pad: { paddingHorizontal: space.lg },
	cards: { paddingHorizontal: space.lg, gap: space.md },
	// The row group's box, the feed's own: the radius and the clip are what make a stack of
	// full-width rows read as one object instead of as strips of the page.
	rows: {
		marginHorizontal: space.lg,
		borderRadius: radius.md,
		overflow: "hidden",
	},
	secondAction: { marginTop: space.sm },
});

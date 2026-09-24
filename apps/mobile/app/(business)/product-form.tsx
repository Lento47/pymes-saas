import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import {
	type Category,
	type Currency,
	currencyExponent,
	formatMoney,
	parseMoney,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Image } from "@/components/image";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import {
	categoryPickerRows,
	indentFor,
	shopSector,
} from "@/lib/category-scope";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, MIN_TOUCH_TARGET, media, space, useTheme } from "@/theme";

/**
 * One product: "add" and "edit" are the same screen, told apart by `id` in the route.
 *
 * ## Five fields, and each omission is a decision rather than an unfinished screen
 *
 * The form writes **name, description, price, a previous price, and a category** — the
 * fields `productFields` carries that a shop's menu actually needs
 * (`packages/shared/src/schemas/catalog.ts:82-93`). Four things it deliberately does not
 * write, because each one is either a field nobody can fill or a field that would be a blind
 * write:
 *
 * - **`status` is written on create and never on update.** The member read
 *   (`products.detail`) could reopen a draft, but this menu lists ACTIVE rows
 *   only by decision (see `app/(business)/products.tsx`) — so a draft created
 *   here would vanish from the list that created it. So the create path sends
 *   `"ACTIVE"`: the honest create is the one that ends with a
 *   product the owner can still see. `apps/web/components/business/product-form.tsx:45`
 *   reached the same conclusion for the same reason, and this screen carries the decision
 *   rather than re-deriving it. `biz.products.publish` and `biz.products.unpublish` are landed
 *   keys and neither is drawn: publishing is what creating already does, and unpublishing is
 *   the one-way door back into invisibility.
 * - **`isFeatured` is not here.** The detail row carries it, but this form has
 *   no merchandising section yet - and a partial update that supplies a field
 *   it never showed is a write that clears it. The web form makes the same call.
 * - **Inventory is not here.** `trackInventory` and `stockQuantity` are also absent from
 *   `productDetailSchema`, and stock is `products.setStock`'s own procedure — a stepper rather
 *   than a field in a form that saves once.
 * - **The photo is a URL, not a picker.** `imageUrl` is a string on the wire and
 *   this app has no way to put bytes anywhere: R2 is deliberately unbound
 *   (`HANDOVER.md`), so a picker in front of it would be the lie
 *   `docs/design-mobile.md:570` rules out. What the form does instead is what the
 *   web form already does (`apps/web/components/business/product-form.tsx`): a URL
 *   box with the picture beside it, previewed live through `./image` — a broken
 *   address falls back to the letter, which is the primitive's own honesty, not a
 *   second error state.
 *
 * ## The compare-at rule is checked here first
 *
 * `productCreateInput` and `productUpdateInput` both refine on it — a previous price at or
 * below the live one is refused by the API — and the sentence is put under the field the
 * owner typed into (`biz.products.compareAt.rule`, the same key the schema's `message` is
 * written for) so the refusal arrives before the round trip instead of as a red line at the
 * top of a form that has to be read back to find the offending box.
 *
 * ## Prices are parsed, and what will be stored is printed under the box
 *
 * `parseMoney("1.500", "CRC")` is fifteen hundred colones and `Number("1.500")` is one and a
 * half. The field's `help` is `formatMoney` of the parsed value, so the difference is visible
 * before it is saved rather than after a customer has seen it. CRC has no minor unit, which is
 * exactly why the conversion runs through the shared helper rather than through arithmetic
 * here.
 *
 * ## The category picker is scoped to this shop's vertical, and the draft arrives filed
 *
 * A shop is filed on a leaf of the taxonomy — `assertLeafCategory` refuses a sector
 * (`apps/api/src/services/businesses.ts`) — so its vertical is that leaf's parent: a bakery is
 * "Food & Beverage", a phone shop is "Electronics & Technology". `@/lib/category-scope` turns
 * that into the list this picker draws, which is the sector's children and not the 242-row
 * tree: if the business is food then all food categories appear, and nothing else does. The
 * `biz.products.category.help` line under the heading names that vertical out loud, because a
 * short list with no explanation reads as a list with rows missing.
 *
 * On create the draft arrives already filed under the shop's own category. Name and price are
 * then the only boxes between an owner and a saved product, and the picker is there to move a
 * product sideways inside its own vertical rather than to answer a question every new product
 * would otherwise ask.
 *
 * ## The field order is the required path first
 *
 * Name and price lead, the previous price hangs with price (both money, both `decimal-pad`),
 * description closes the group as the long optional text, category is the pre-filled short
 * list, and the photo URL is last. The photo used to *lead* this form. A box asking for an
 * address is both the least inviting first field and the one nobody can fill well, and it is
 * optional on top of that — so it moved to the end, where an owner who has a URL can find it
 * and one who does not never meets it on the way to "save".
 */

type Draft = {
	name: string;
	description: string;
	price: string;
	compareAt: string;
	categoryId: string | null;
	photo: string;
};

const EMPTY_DRAFT: Draft = {
	name: "",
	description: "",
	price: "",
	compareAt: "",
	categoryId: null,
	photo: "",
};

/** The wire's own shape check, restated before the round trip (`imageUrlSchema`). */
function photoShapeOk(value: string): boolean {
	const trimmed = value.trim();
	return (
		trimmed === "" ||
		trimmed.startsWith("/") ||
		/^https:\/\/[\w.-]+(:\d+)?(\/.*)?$/.test(trimmed)
	);
}

export default function ProductFormScreen() {
	const { t } = useT();
	const trpc = useTRPC();
	const params = useLocalSearchParams<{ businessId?: string; id?: string }>();

	const businessId = params.businessId ?? "";
	const productId = params.id;

	const detail = useQuery(
		trpc.products.detail.queryOptions(
			{ businessId, id: productId ?? "" },
			{ enabled: productId !== undefined && businessId.length > 0 },
		),
	);
	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId },
			// Read on both paths, for two different facts. Currency: an "add" has no product
			// to carry one yet, while an "edit" takes it from the product — the shop's currency
			// is fixed at creation and the two cannot disagree, but the product's own value is
			// the one the prices on it were written in. Category: both paths need the shop's
			// own `categoryId`, which is what a new product files under and what scopes the
			// picker to this shop's vertical (`@/lib/category-scope`).
			{ enabled: businessId.length > 0 },
		),
	);
	const categories = useQuery(trpc.catalog.categories.queryOptions());

	// `isLoading`, not `isPending`: `detail` is `enabled: productId !== undefined`, and a
	// disabled query reports `isPending` forever — which would hold the skeleton up on the
	// "add" path that deliberately never asks for a product. `isLoading` is the one that means
	// "an enabled read is still on the network", which is what the hold is for.
	const waiting = useSkeletonHold(
		detail.isLoading || settings.isLoading || categories.isLoading,
	);

	// A route without a shop cannot be saved against: every write names the business it edits.
	// This is not reachable from the menu, which is the only caller — it is reachable by deep
	// link, and the honest answer to one is the same sentence an account with no shop reads.
	if (businessId.length === 0) {
		return (
			<Screen title={t("biz.products.title")} scroll bottomInset>
				<SignedIn>
					<EmptyState
						icon="storefront-outline"
						title={t("biz.permission.title")}
						body={t("biz.permission.body")}
					/>
				</SignedIn>
			</Screen>
		);
	}

	const failed = detail.error ?? settings.error ?? categories.error;
	const currency =
		productId === undefined ? settings.data?.currency : detail.data?.currency;

	return (
		<Screen
			title={
				productId === undefined ? t("biz.products.add") : t("biz.products.edit")
			}
			scroll
			// The four text inputs and the bar under them: the frame is what knows which platform
			// needs the keyboard's height paid as an inset, so the screen asks for it rather than
			// measuring anything itself.
			keyboardInsets
			contentStyle={styles.content}
		>
			<SignedIn>
				{failed ? (
					<ErrorState
						error={failed}
						onRetry={() => {
							void detail.refetch();
							void settings.refetch();
							void categories.refetch();
						}}
					/>
				) : waiting || !currency ? (
					<FormSkeleton loadingLabel={t("state.loading")} />
				) : (
					<Fields
						businessId={businessId}
						productId={productId}
						currency={currency}
						categories={categories.data ?? []}
						businessCategoryId={settings.data?.categoryId ?? null}
						// A new product arrives filed under the shop's own category: the picker is
						// then a sideways move inside the shop's vertical rather than a question
						// every product has to answer from scratch. `EMPTY_DRAFT` keeps `categoryId`
						// null for the one shop the read cannot name one for.
						initial={
							detail.data === undefined
								? {
										...EMPTY_DRAFT,
										categoryId: settings.data?.categoryId ?? null,
									}
								: {
										name: detail.data.title,
										description: detail.data.description ?? "",
										price: editableOf(detail.data.priceMinor, currency),
										compareAt:
											detail.data.compareAtPriceMinor === null
												? ""
												: editableOf(detail.data.compareAtPriceMinor, currency),
										categoryId: detail.data.categoryId,
										photo: detail.data.imageUrl ?? "",
									}
						}
					/>
				)}
			</SignedIn>
		</Screen>
	);
}

/**
 * The minor units as the major-unit string the owner typed, and the inverse of `parseMoney`
 * for the currency it is given.
 *
 * `formatMoney` is deliberately not used here even though it is the app's one money formatter:
 * it returns "₡1 500", and feeding a currency symbol back into the box the owner edits would
 * put a character in front of them that `parseMoney` then has to strip. The exponent is
 * `currencyExponent`'s, so a currency with a minor unit prefills "12.5" rather than "12.50"
 * rounded away — what the owner saved is what they read back.
 */
function editableOf(amountMinor: number, currency: Currency): string {
	return String(amountMinor / 10 ** currencyExponent(currency));
}

/**
 * The form, mounted once with the values it will edit.
 *
 * A separate component because the draft is `useState` seeded from the loaded product: it
 * mounts when the read has landed, so the box is filled on its first render and no effect
 * copies a value into state after the fact — which is the effect that would overwrite what a
 * fast typist had already written.
 */
function Fields({
	businessId,
	productId,
	currency,
	categories,
	businessCategoryId,
	initial,
}: {
	businessId: string;
	productId?: string;
	currency: Currency;
	categories: Category[];
	/** The shop's own `categoryId` — a leaf. What scopes the picker and names the help line. */
	businessCategoryId: string | null;
	initial: Draft;
}) {
	const { t, locale } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();

	const [draft, setDraft] = useState(initial);
	const [submitted, setSubmitted] = useState(false);
	const [picking, setPicking] = useState(false);

	/*
	 * The picker draws this shop's vertical and nothing else — see `@/lib/category-scope`,
	 * which owns both the scoping rule and the shape of the list it returns. A shop with a
	 * readable category gets its sector's children flat (about ten rows); the expansion below
	 * is only the fallback for a shop the read cannot name a vertical for, and it is derived
	 * from the draft rather than held in its own state so the accordion opens on the branch
	 * the product's category is already in.
	 */
	const chosen = categories.find((one) => one.id === draft.categoryId);
	const openSectorId =
		chosen === undefined ? undefined : (chosen.parentId ?? chosen.id);
	const pickerRows = categoryPickerRows(categories, {
		businessCategoryId,
		chosenId: draft.categoryId,
		openSectorId,
	});
	// The vertical's name, for the help line under the heading. `null` when the shop has
	// none to read, and then the help line is not drawn at all rather than printed without
	// its value.
	const sector = shopSector(categories, businessCategoryId);
	// A guard rather than a disabled button alone: two taps inside one frame both pass an
	// `isPending` check that has not re-rendered yet, and a duplicate product is a row the
	// owner then has to find and archive.
	const inFlight = useRef(false);

	const priceMinor = parseMoney(draft.price, currency);
	const compareAtBlank = draft.compareAt.trim() === "";
	const compareAtMinor = compareAtBlank
		? null
		: parseMoney(draft.compareAt, currency);

	const compareAtTooLow =
		compareAtMinor !== null &&
		priceMinor !== null &&
		compareAtMinor <= priceMinor;

	const problems = useMemo(() => {
		const found: Partial<
			Record<"name" | "price" | "compareAt" | "photo", string>
		> = {};
		if (draft.name.trim() === "") found.name = t("form.required");
		// Unparseable and empty are one failure from here: both leave `priceMinor` null, and
		// the API's own schema would refuse either.
		if (priceMinor === null) found.price = t("form.required");
		if (compareAtTooLow) found.compareAt = t("biz.products.compareAt.rule");
		else if (!compareAtBlank && compareAtMinor === null) {
			found.compareAt = t("form.required");
		}
		if (!photoShapeOk(draft.photo)) found.photo = t("biz.products.photo.rule");
		return found;
	}, [
		draft.name,
		draft.photo,
		priceMinor,
		compareAtTooLow,
		compareAtBlank,
		compareAtMinor,
		t,
	]);

	const done = (message: string) => {
		// Both reads, through the router's own key: the menu is one of them and the product the
		// form just opened is the other, and `products` is small enough that naming the two
		// separately would be naming the same subtree twice.
		void cache.invalidateQueries({ queryKey: trpc.products.pathKey() });
		toast.show(message);
		router.back();
	};

	const create = useMutation(
		trpc.products.create.mutationOptions({
			onSuccess: () => done(t("biz.products.created")),
		}),
	);

	const update = useMutation(
		trpc.products.update.mutationOptions({
			onSuccess: () => done(t("biz.products.saved")),
		}),
	);

	const failure = useApiFailure(create.error ?? update.error);
	const pending = create.isPending || update.isPending;

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone, so the assertion on the
	 * failure line below is the whole of Android's announcement and iOS, which ignores the
	 * prop, has to be told. Guarded by the platform rather than announced on both: a sentence a
	 * live region has already spoken is not read twice, it is read as two sentences.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !failure.message) return;
		AccessibilityInfo.announceForAccessibility(failure.message);
	}, [failure.message]);

	const edited = (apply: () => void) => {
		apply();
		if (create.isError || create.isSuccess) create.reset();
		if (update.isError || update.isSuccess) update.reset();
	};

	const submit = () => {
		if (inFlight.current) return;
		setSubmitted(true);
		if (Object.keys(problems).length > 0 || priceMinor === null) return;
		inFlight.current = true;

		const categoryId = draft.categoryId ?? undefined;
		const name = draft.name.trim();
		// Absent means "leave it" on update and null on create (`assign` skips
		// `undefined`, and the column already defaults null): an emptied box
		// keeps the stored picture rather than clearing it, because the update
		// input takes no null for this field and a silent keep beats a refused
		// write the owner did not ask for.
		const imageUrl = draft.photo.trim() || undefined;

		if (productId !== undefined) {
			update.mutate(
				{
					businessId,
					id: productId,
					name,
					// `""` clears the description and `undefined` leaves it, so an emptied box is
					// sent as an empty string rather than omitted — the one field here where the
					// two are different writes.
					description: draft.description.trim(),
					priceMinor,
					compareAtPriceMinor: compareAtMinor,
					categoryId,
					imageUrl,
				},
				{ onSettled: () => (inFlight.current = false) },
			);
			return;
		}

		create.mutate(
			{
				businessId,
				name,
				description: draft.description.trim() || undefined,
				priceMinor,
				compareAtPriceMinor: compareAtMinor ?? undefined,
				categoryId,
				imageUrl,
				// See the docblock: a `DRAFT` is invisible *and* uneditable to the person who
				// just made it, so the create that ends visible is the honest one.
				status: "ACTIVE",
			},
			{ onSettled: () => (inFlight.current = false) },
		);
	};

	return (
		<View style={styles.root}>
			<View style={styles.content}>
				{/* The picture, and the box that names it. A URL rather than a picker —
				    see the file docblock — previewed live beside the box: the letter
				    is the product's initial the way `./product-row` draws it, the
				    glyph is the stand-in while the product still has no name, and a
				    broken address falls back to the letter through `./image` itself.
				    Decorative either way: the name below already says what this is. */}
				<AnimateIn index={0}>
					<ScreenSection title={t("biz.products.title")}>
						<Field
							label={t("biz.products.name")}
							value={draft.name}
							onChangeText={(value) =>
								edited(() => setDraft((was) => ({ ...was, name: value })))
							}
							error={submitted ? (problems.name ?? null) : null}
							maxLength={150}
						/>
						{/* The money, beside each other: `price` is the one of the two that is required, so
							it leads, and `compareAt` hangs with it because they share a keyboard and one
							rule (a previous price at or below the live one is refused). */}
						<Field
							label={t("biz.products.price")}
							value={draft.price}
							onChangeText={(value) =>
								edited(() => setDraft((was) => ({ ...was, price: value })))
							}
							error={submitted ? (problems.price ?? null) : null}
							// What the API will store, printed under the box — see the docblock.
							help={
								priceMinor === null
									? undefined
									: formatMoney(priceMinor, currency)
							}
							keyboardType="decimal-pad"
							inputMode="decimal"
						/>
						<Field
							label={t("biz.products.compareAt")}
							value={draft.compareAt}
							onChangeText={(value) =>
								edited(() => setDraft((was) => ({ ...was, compareAt: value })))
							}
							error={submitted ? (problems.compareAt ?? null) : null}
							help={
								compareAtMinor === null
									? t("biz.products.compareAt.rule")
									: formatMoney(compareAtMinor, currency)
							}
							keyboardType="decimal-pad"
							inputMode="decimal"
						/>
						{/* The long optional text closes the group: an owner who has a name and a price
							can save now, and the description is there for the one who has more to say. */}
						<Field
							label={t("biz.products.description")}
							value={draft.description}
							onChangeText={(value) =>
								edited(() =>
									setDraft((was) => ({ ...was, description: value })),
								)
							}
							multiline
							maxLength={600}
						/>
					</ScreenSection>
				</AnimateIn>

				<AnimateIn index={1}>
					<ScreenSection title={t("biz.products.category")}>
						{/* The list opens in place rather than in a `./sheet`, which is the panel
							`app/new-business` uses for the same choice: this screen's body is one
							scroll view (`./screen`'s `scroll`), and a sheet mounted inside a scroll
							view is laid out in its content and scrolls away with it. The row above
							the list names the choice and toggles it. */}
						{sector !== null ? (
							<Text variant="caption" tone="muted">
								{t("biz.products.category.help", {
									sector: localizedName(sector, locale),
								})}
							</Text>
						) : null}
						<Card>
							<ListRow
								title={
									chosen
										? localizedName(chosen, locale)
										: t("biz.products.category")
								}
								state={chosen ? t("biz.new.selected") : undefined}
								chevron
								divider={picking}
								onPress={() => setPicking((was) => !was)}
							/>
							{picking
								? pickerRows.map((row, index) => {
										const selected = draft.categoryId === row.id;
										const hasChildren = categories.some(
											(one) => one.parentId === row.id,
										);
										return (
											<ListRow
												key={row.id}
												title={localizedName(row, locale)}
												// A row steps in under its parent exactly when that parent is
												// also on the list — see `indentFor`. Scoped, the sector is
												// absent and its children sit flush as peers; unscoped, the
												// sector is present and its children step in under it.
												leading={
													indentFor(pickerRows, row) ? (
														<View style={styles.indent} />
													) : undefined
												}
												divider={index < pickerRows.length - 1}
												state={selected ? t("biz.new.selected") : undefined}
												onPress={() => {
													// A picker settling on a value: the haptic answers
													// the tap that changes the category, not a re-tap
													// of the one already on (`./business`'s ShopChips
													// rule).
													if (!selected) selection();
													edited(() =>
														setDraft((was) => ({
															...was,
															categoryId: row.id,
														})),
													);
													if (!hasChildren) setPicking(false);
												}}
											/>
										);
									})
								: null}
						</Card>
					</ScreenSection>
				</AnimateIn>

				{/* The photo URL, last. See the file docblock: it is optional, it is the one field
					nobody can fill well, and it used to *lead* this form — which is the same thing as
					putting the hardest optional box between an owner and their first save. */}
				<AnimateIn index={2}>
					<View style={styles.photoRow}>
						<Image
							uri={draft.photo.trim() || null}
							radiusToken="md"
							style={styles.photo}
							accessibilityElementsHidden
							importantForAccessibility="no"
						>
							{draft.name.trim() ? (
								<Text variant="title" tone="action" bold>
									{draft.name.trim().charAt(0).toUpperCase()}
								</Text>
							) : (
								<Ionicons
									name="image-outline"
									size={icon.action}
									color={colors.mutedForeground}
								/>
							)}
						</Image>
						<View style={styles.photoField}>
							<Field
								label={t("biz.products.photo")}
								value={draft.photo}
								onChangeText={(value) =>
									edited(() => setDraft((was) => ({ ...was, photo: value })))
								}
								error={submitted ? (problems.photo ?? null) : null}
								help={t("biz.products.photo.help")}
								keyboardType="url"
								autoCapitalize="none"
								autoCorrect={false}
								maxLength={500}
							/>
						</View>
					</View>
				</AnimateIn>

				{failure.message ? (
					<Text
						variant="body"
						tone="destructive"
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						{failure.message}
					</Text>
				) : null}
			</View>

			<ActionBar
				docked
				primary={{
					label: t("biz.settings.save"),
					onPress: submit,
					loading: pending,
					disabled: pending,
				}}
			/>
		</View>
	);
}

/**
 * The form's column, before the reads answer: the four fields (name, price, previous price,
 * description) each its label, box and reserved message row, then the category `Card` with
 * the help line and the one row the list toggles open, and the photo's thumb beside its own
 * `./field` of three rows last. The order is the real form's — required path first, photo
 * tail — so the skeleton and the form it stands in for are the same page. The heights are the
 * real form's at the reader's text scale, which is why every line goes through `line()` rather
 * than through a fixed number, and the page does not jump when the values land.
 *
 * The section headings are the screen's own copy — `biz.products.title` and
 * `biz.products.category`, facts the read does not carry — so the sections are drawn real
 * and only the values are grey. The category's help line is grey for the same reason the
 * field labels are not: its words carry the shop's vertical, which is exactly the fact the
 * read that is still in flight has not answered yet. `./skeleton`'s `Skeleton` carries the
 * label on the first line — a shape with no text in the accessibility tree is a shape a
 * reader is told nothing about.
 */
function FormSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// One `./list-row`: the category row's `space.md` of vertical padding twice around its
	// title's `body` line, over the row's own touch floor — the box the closed row pays.
	const categoryRow = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 + line("body", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<ScreenSection title={t("biz.products.title")}>
				{/* The four fields, each its three rows. The description's box is `multiline`
				    and blank it sits at the same floor — the box grows with what is typed into
				    it, not with being empty, which is the sum the note field's block draws in
				    `./skeletons` for the same multiline `./field`. */}
				{[0, 1, 2, 3].map((index) => (
					<View key={index} style={formStyles.field}>
						<Skeleton style={[formStyles.label, line("label", fontScale)]} />
						<Skeleton style={formStyles.input} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				))}
			</ScreenSection>

			<ScreenSection title={t("biz.products.category")}>
				{/* The help line stands in for `biz.products.category.help`, whose value is the
				    shop's vertical — the one name the in-flight settings read has not answered.
				    One caption line, then the closed row. */}
				<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				<Card>
					<Skeleton style={{ height: categoryRow }} />
				</Card>
			</ScreenSection>

			{/* The photo, last — same order as the form. The thumb is `media.row`'s box and
			    the field beside it is still its three rows, with the label on the first. */}
			<View style={styles.photoRow}>
				<Skeleton style={styles.photo} />
				<View style={[styles.photoField, formStyles.field]}>
					<Skeleton
						label={loadingLabel}
						style={[formStyles.label, line("label", fontScale)]}
					/>
					<Skeleton style={formStyles.input} />
					<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	// The picture beside its box: the thumb is `./product-row`'s own 60pt box
	// (`media.row`), because it previews the picture the menu row will draw.
	photoRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	photo: { width: media.row, height: media.row },
	photoField: { flex: 1 },
	// One step of the scale, applied only to a row whose parent is also on the list (`indentFor`).
	// Scoped, the sector is absent and its children sit flush as peers; unscoped, the sector is
	// present and its children step in under it. Either way this is air, never a second row shape.
	indent: { width: space.lg },
});

/**
 * The grey field's own rows: `./field`'s `wrap` gap between the label, the box and the
 * message row (`components/field.tsx`'s `wrap`), the box at the floor the real input pays
 * (`components/field.tsx`'s `input`), and a line each for the label and the message — the
 * label's width is a stand-in for a word the read does not carry, and the message row is
 * reserved, so it is a line rather than an empty box.
 */
const formStyles = StyleSheet.create({
	field: { gap: space.sm },
	label: { width: "35%" },
	input: { minHeight: MIN_TOUCH_TARGET },
	message: { width: "60%" },
});

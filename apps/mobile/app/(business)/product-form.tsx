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
import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field, SOFT_FIELD_HEIGHT } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { PHOTO_MODULE_HEIGHT, PhotoPicker } from "@/components/photo-picker";
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
import { icon, MIN_TOUCH_TARGET, radius, space, type, useTheme } from "@/theme";

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
 * - **The photo is a picker, and the bytes land in the API.** `uploads.create`
 *   takes base64 and a mime type, refuses anything that is not JPEG/PNG/WebP
 *   under 2 MB, and answers with `/files/:id`, which is what `imageUrlSchema`
 *   already accepts, so the path is stored on `imageUrl` unchanged and `./image`
 *   draws it. `components/photo-picker` is the two controls - "Subir foto" and
 *   "Tomar foto", because they are two acts - and this screen only owns where the
 *   returned path goes. The preview still falls back to the letter, which is
 *   `./image`'s honesty rather than a second error state.
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
 * list, and the photo is last. The photo used to *lead* this form. It is the
 * optional one nobody can fill well in a hurry, and it is on top of that the only
 * control here that opens a system picker, so it moved to the end, where an owner
 * who has a picture can find it and one who does not never meets it on the way to
 * "save".
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
			subtitle={
				productId === undefined
					? t("biz.products.screen.add")
					: t("biz.products.screen.edit")
			}
			// A pushed screen with no visible way back. `product-form` is one of the
			// `MERCHANT_BARLESS_ROUTES`, so it is a tab to the navigator and the gesture
			// works — but a form the owner cannot leave without a swipe is a form with a
			// gesture where a control should be, and the disc is the one filled control this
			// screen's own heading is loud enough to need a peer for.
			leading={<BackButton to="/(business)/products" surface />}
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
		const found: Partial<Record<"name" | "price" | "compareAt", string>> = {};
		if (draft.name.trim() === "") found.name = t("form.required");
		// Unparseable and empty are one failure from here: both leave `priceMinor` null, and
		// the API's own schema would refuse either.
		if (priceMinor === null) found.price = t("form.required");
		if (compareAtTooLow) found.compareAt = t("biz.products.compareAt.rule");
		else if (!compareAtBlank && compareAtMinor === null) {
			found.compareAt = t("form.required");
		}
		return found;
	}, [
		draft.name,
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

	/**
	 * The two marks the price boxes carry, and both are derived rather than chosen.
	 *
	 * `symbol` is the currency's own for the reader's locale — see `currencySymbol`. It is
	 * computed once per render and handed to both boxes, because two calls to the same
	 * formatter in two branches of one layout is two chances for the two chips to disagree.
	 *
	 * `priceHint` is the empty-state shape of an amount, and it is the currency's precision
	 * rather than a literal: a colon has no minor unit, so its hint is `0` and a dollar's is
	 * `0.00`. Typing "0,00" into a box whose separator the keyboard may not produce is the
	 * kind of placeholder that teaches a reader the wrong thing before they have typed a
	 * digit.
	 */
	const symbol = currencySymbol(currency, locale);
	const priceHint = currencyExponent(currency) === 0 ? "0" : "0.00";

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
				{/* §1. Name, alone in its group. The group heading is what the group is
				    for, not a second copy of the screen's own title: `biz.products.title`
				    is "Productos", and the strip above already says "Agregar producto", so
				    the old heading repeated the page and told the owner nothing. */}
				<AnimateIn index={0}>
					<ScreenSection
						title={t("biz.products.section.basic")}
						subtitle={t("biz.products.section.basic.help")}
					>
						<Field
							variant="soft"
							label={t("biz.products.name")}
							value={draft.name}
							onChangeText={(value) =>
								edited(() => setDraft((was) => ({ ...was, name: value })))
							}
							error={submitted ? (problems.name ?? null) : null}
							placeholder={t("biz.products.placeholder.name")}
							affix={<FieldGlyph name="pricetag-outline" />}
							maxLength={150}
						/>
					</ScreenSection>
				</AnimateIn>

				{/* §2. The money, side by side. Two boxes on one line is not a layout
				    preference here: the pair is one idea — what this costs, and what it
				    used to cost — and the rule that ties them, a previous price at or
				    below the live one being refused, is why they belong in one glance.
				    Stacked, the sentence about that rule sits 44pt below the box that has
				    to obey it.

				    Each keeps its own reserved message row, so the pair is the same height
				    whether or not either is saying something: the compare-at rule is
				    always printed, and an error appearing under the price must not move
				    the box beside it. */}
				<AnimateIn index={1}>
					<ScreenSection
						title={t("biz.products.section.pricing")}
						subtitle={t("biz.products.section.pricing.help")}
					>
						<View style={styles.pair}>
							<Field
								variant="soft"
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
								placeholder={priceHint}
								affix={<FieldGlyph label={symbol} />}
								keyboardType="decimal-pad"
								inputMode="decimal"
							/>
							<Field
								variant="soft"
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
								placeholder={priceHint}
								affix={<FieldGlyph label={symbol} />}
								keyboardType="decimal-pad"
								inputMode="decimal"
							/>
						</View>
						{/* The long optional text, drawn as a paragraph rather than as a
						    fifth name field. Its message row is off because it has neither
						    an `error` nor a `help` to put in it, and on a box this tall a
						    reserved line nobody ever fills is sixteen points of nothing
						    between the description and the next heading. */}
						<Field
							variant="soft"
							label={t("biz.products.description")}
							value={draft.description}
							onChangeText={(value) =>
								edited(() =>
									setDraft((was) => ({ ...was, description: value })),
								)
							}
							multiline
							placeholder={t("biz.products.placeholder.description")}
							affix={<FieldGlyph name="document-text-outline" />}
							style={styles.description}
							maxLength={DESCRIPTION_MAX}
							counter
							reserveMessage={false}
						/>
					</ScreenSection>
				</AnimateIn>

				<AnimateIn index={2}>
					<ScreenSection
						title={t("biz.products.category")}
						subtitle={t("biz.products.section.category.help")}
					>
						{/* The list opens in place rather than in a `./sheet`, which is the panel
						    `app/new-business` uses for the same choice: this screen's body is one
						    scroll view (`./screen`'s `scroll`), and a sheet mounted inside a scroll
						    view is laid out in its content and scrolls away with it. The row above
						    the list names the choice and toggles it.

						    A filled surface rather than a `Card`: a card carries a hairline and
						    `shadow.card`, and on a white canvas neither of those is what
						    separates it from the page — the fill is. The closed row carries no
						    "Selected" word, because there is one choice on screen and the
						    checkmark is not available for a row this size. */}
						<View
							style={[
								styles.selector,
								{ backgroundColor: colors.muted, borderColor: colors.border },
							]}
						>
							<ListRow
								leading={
									<View style={styles.selectorMark}>
										<Ionicons
											name="grid-outline"
											size={icon.action}
											color={colors.foreground}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</View>
								}
								title={
									chosen
										? localizedName(chosen, locale)
										: t("biz.products.category")
								}
								subtitle={
									sector === null
										? undefined
										: t("biz.products.category.help", {
												sector: localizedName(sector, locale),
											})
								}
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
						</View>
					</ScreenSection>
				</AnimateIn>

				{/* A photo, last. See the file docblock: it is optional, it is the one
				    control here that opens a system picker, and it used to *lead* this
				    form as a URL box, which is the same thing as putting the hardest
				    optional field between an owner and their first save. */}
				<AnimateIn index={3}>
					<ScreenSection
						title={t("biz.products.photo")}
						subtitle={t("biz.products.section.photo.help")}
					>
						<PhotoPicker
							layout="module"
							label={t("biz.products.photo.module")}
							value={draft.photo.trim() || null}
							onChange={(next) =>
								edited(() => setDraft((was) => ({ ...was, photo: next ?? "" })))
							}
							uploadLabel={t("biz.products.photo.upload")}
							cameraLabel={t("biz.products.photo.camera")}
							help={t("biz.products.photo.module.help")}
						/>
					</ScreenSection>
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
					label: t("biz.products.save"),
					onPress: submit,
					loading: pending,
					disabled: pending,
				}}
			/>
		</View>
	);
}

/**
 * The description's ceiling, and the number its counter prints.
 *
 * Named because the copy of it exists in two places that must not drift: the input's own
 * `maxLength` and the counter `./field` reads off it. The counter does not take a number —
 * it takes the ceiling from the input — so there is one number on this screen and this is
 * where it is written down.
 */
const DESCRIPTION_MAX = 500;

/**
 * The description box's height.
 *
 * Its own number rather than one of the shared steps, and that is the point of writing it
 * down here: `Field`'s soft box is 52 and this is a paragraph, so it cannot borrow that,
 * and the two heights together with the module's are the three boxes a skeleton has to
 * draw. `FormSkeleton` reads this same constant rather than typing `104` again.
 */
const DESCRIPTION_HEIGHT = 104;

/**
 * The currency's own mark, from CLDR rather than from a table written here.
 *
 * `currencyDisplay: "symbol"` answers for the reader in their own locale — `₡` for a
 * Costa Rican shop, `$` for a US one — which is why there is no map from currency to glyph
 * in this file. A hand-written table would be a second source for a fact `Intl` already
 * carries, and the day a shop is billed in a currency nobody wrote down it would draw a
 * code in the chip and look broken.
 *
 * `formatToParts` rather than `format`, because `format` returns the *amount* with the mark
 * somewhere inside it and the chip wants the mark alone. The `catch` is not decoration: this
 * runs during a render, and a runtime whose `Intl` cannot build the pair throws rather than
 * degrades — the bare ISO code is an ugly chip, and an ugly chip beats a blank screen.
 */
function currencySymbol(currency: Currency, locale: string): string {
	try {
		const parts = new Intl.NumberFormat(locale, {
			style: "currency",
			currency,
			currencyDisplay: "symbol",
		}).formatToParts(0);
		return parts.find((part) => part.type === "currency")?.value ?? currency;
	} catch {
		return currency;
	}
}

/**
 * What a field's leading chip holds: a mark, or the currency.
 *
 * Two shapes because the two affixes are two different things, and the difference is not
 * decoration. A glyph is decoration — `./field` already hides the whole chip from the
 * accessibility tree — and is drawn at `icon.action` in `mutedForeground`. The currency is
 * a short piece of label weight at `type.label` bold, because a price box whose chip says
 * "₡" in the same grey as a pictogram has told the owner nothing about which field they
 * are in.
 */
function FieldGlyph({
	name,
	label: text,
}: {
	name?: React.ComponentProps<typeof Ionicons>["name"];
	label?: string;
}) {
	const { colors } = useTheme();
	if (text !== undefined) {
		return (
			<Text variant="label" bold>
				{text}
			</Text>
		);
	}
	return (
		<Ionicons
			name={name ?? "image-outline"}
			size={icon.action}
			color={colors.mutedForeground}
			accessibilityElementsHidden
			importantForAccessibility="no"
		/>
	);
}

/**
 * The form's column, before the reads answer.
 *
 * The order is the real form's — name, the two prices, the description, category, photo — so
 * the skeleton and the form it stands in for are the same page, and the page does not jump
 * when the values land. Every line goes through `line()` rather than through a fixed number
 * for the reason `./skeletons` gives: the reader's text scale multiplies a line box and
 * nothing else, and a skeleton drawn at 100% on a phone set to 200% is a page that moves
 * once the content arrives.
 *
 * The section headings and their lines are the screen's own copy, which is right: they are
 * facts the read does not carry and no value is involved, so drawing them real costs
 * nothing and keeps the page from reflowing. The two prices stand in as one row for the same
 * reason they are one row above. `./skeleton`'s `Skeleton` carries the label on the first
 * line — a shape with no text in the accessibility tree is a shape a reader is told nothing
 * about.
 */
function FormSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { colors } = useTheme();
	const { fontScale } = useWindowDimensions();

	// One `./list-row`: the category row's `space.md` of vertical padding twice around its
	// title's `body` line, over the row's own touch floor — the box the closed row pays.
	const categoryRow = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 + line("body", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<ScreenSection
				title={t("biz.products.section.basic")}
				subtitle={t("biz.products.section.basic.help")}
			>
				<Skeleton
					label={loadingLabel}
					style={[formStyles.label, line("label", fontScale)]}
				/>
				<Skeleton style={formStyles.inputSoft} />
				<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
			</ScreenSection>

			<ScreenSection
				title={t("biz.products.section.pricing")}
				subtitle={t("biz.products.section.pricing.help")}
			>
				{/* The two money boxes, side by side and one row deep, because that is the
				    shape they take once the read lands. */}
				<View style={styles.pair}>
					<View style={styles.pairItem}>
						<Skeleton
							style={[formStyles.label, line("label", fontScale)]}
						/>
						<Skeleton style={formStyles.inputSoft} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
					<View style={styles.pairItem}>
						<Skeleton
							style={[formStyles.label, line("label", fontScale)]}
						/>
						<Skeleton style={formStyles.inputSoft} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				</View>
				<Skeleton style={[formStyles.label, line("label", fontScale)]} />
				<Skeleton style={formStyles.description} />
			</ScreenSection>

			<ScreenSection
				title={t("biz.products.category")}
				subtitle={t("biz.products.section.category.help")}
			>
				<View
					style={[
						styles.selector,
						{ backgroundColor: colors.muted, borderColor: colors.border },
					]}
				>
					<Skeleton style={{ height: categoryRow }} />
				</View>
			</ScreenSection>

			<ScreenSection
				title={t("biz.products.photo")}
				subtitle={t("biz.products.section.photo.help")}
			>
				<Skeleton style={formStyles.photoModule} />
			</ScreenSection>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	/**
	 * The two money boxes, side by side, at the width the interface spec measures at a 390pt
	 * viewport: a 10pt gap and 174pt each, which is `flex: 1` on both sides rather than two
	 * typed numbers — 174 is what 390 minus two 16pt gutters minus the gap works out to, and
	 * a typed width would be wrong on every viewport that is not that one.
	 *
	 * `minWidth: 0` is what lets the row shrink: without it a `Field`'s own `minHeight` and
	 * the message row's natural width floor the pair at their content's width, and on a
	 * narrow phone the second box is pushed off the edge rather than wrapping.
	 */
	pair: { flexDirection: "row", gap: 10 },
	pairItem: { flex: 1, minWidth: 0 },
	// A paragraph, not a fifth name field: 104 points of box under one line of label, which
	// is the height the spec asks for and the point at which an owner can see three or four
	// lines of what they have written.
	description: { minHeight: DESCRIPTION_HEIGHT },
	// The category's surface, matching the fields' language rather than a card's: the same
	// fill, one step softer on the corner, and a hairline that is the only edge on a white
	// canvas. `overflow: "hidden"` is what lets the expanded list be clipped by it.
	selector: {
		borderRadius: radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	// The mark at the selector's leading edge, on the page's own white so it reads as a chip
	// cut out of the fill rather than a second fill inside it.
	selectorMark: {
		width: 40,
		height: 40,
		borderRadius: radius.md,
		alignItems: "center",
		justifyContent: "center",
	},
	// One step of the scale, applied only to a row whose parent is also on the list (`indentFor`).
	// Scoped, the sector is absent and its children sit flush as peers; unscoped, the sector is
	// present and its children step in under it. Either way this is air, never a second row shape.
	indent: { width: space.lg },
});

/**
 * The grey field's own rows: `./field`'s `wrap` gap between the label, the box and the
 * message row (`components/field.tsx`'s `wrap`), a box at each height the real input pays
 * (`inputSoft`'s 52 and `description`'s 104), and a line each for the label and the message —
 * the label's width is a stand-in for a word the read does not carry, and the message row is
 * reserved, so it is a line rather than an empty box.
 */
const formStyles = StyleSheet.create({
	label: { width: "35%" },
	inputSoft: { height: SOFT_FIELD_HEIGHT },
	description: { height: DESCRIPTION_HEIGHT },
	// The media surface, at the module's own height rather than `photo-picker`'s ratio, so
	// the two stand in for the same box.
	photoModule: { height: PHOTO_MODULE_HEIGHT },
	message: { width: "60%" },
});
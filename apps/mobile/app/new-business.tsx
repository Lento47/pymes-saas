import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import type { Currency } from "@pymeshub/shared";
import { CURRENCIES } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { icon, MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

/**
 * Step two of opening a shop: the facts a business cannot exist without.
 *
 * Lives at the root rather than in `(business)` on purpose: the reader has no
 * shop yet, so the business tree's guard would bounce them to the customer
 * feed before the form drew. Same for the delivery step this leads to.
 *
 * Name, address and at least one way to hand over an order — the rest
 * (hours, products, delivery numbers, the courier) comes later, on the board
 * and on the delivery step this screen leads to. The shop starts DRAFT: going
 * live is `business.setStatus`, a decision for a shop with products rather
 * than for a form that was just filled in.
 *
 * Labels reuse the settings form's (`biz.settings.*`, `account.addresses.*`)
 * on purpose: two sets of names for the same fields drift into saying
 * different things, and the board's settings screen is where these values
 * live afterwards.
 */
export default function NewBusiness() {
	const { t, locale } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { status } = useSession();
	const { colors } = useTheme();

	const signedIn = status === "signed-in";
	const categories = useQuery(trpc.catalog.categories.queryOptions());

	const [name, setName] = useState("");
	const [line1, setLine1] = useState("");
	const [city, setCity] = useState("");
	const [region, setRegion] = useState("");
	const [phone, setPhone] = useState<string | null>(null);
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [currency, setCurrency] = useState<Currency>("CRC");
	const [currencyOpen, setCurrencyOpen] = useState(false);
	const [delivery, setDelivery] = useState(true);
	const [pickup, setPickup] = useState(true);
	const [blurred, setBlurred] = useState({ name: false, line1: false });
	const [submitted, setSubmitted] = useState(false);
	const [categoryOpen, setCategoryOpen] = useState(false);
	const [openSectorId, setOpenSectorId] = useState<string | undefined>(
		undefined,
	);
	const inFlight = useRef(false);

	/*
	 * The taxonomy is two levels — 18 sectors and their 224 children — and
	 * `catalog.categories` returns both, each sector immediately followed by the categories
	 * it holds. A picker cannot draw 242 rows, so it draws the sectors and expands one.
	 *
	 * The expansion is the reader's and not the choice's: a sector is an expander rather than a
	 * choice, so tapping one has to open it without filing the shop under anything. It falls
	 * back to the sector of the category already chosen, so the panel reopens on the branch the
	 * shop is filed under instead of on all eighteen sectors level with each other.
	 */
	const all = categories.data ?? [];
	const chosen = all.find((one) => one.id === categoryId);
	const expandedSectorId = openSectorId ?? chosen?.parentId ?? undefined;
	const pickerRows = all
		.filter((one) => one.parentId === null)
		.flatMap((sector) =>
			sector.id === expandedSectorId
				? [sector, ...all.filter((one) => one.parentId === sector.id)]
				: [sector],
		);

	const create = useMutation(
		trpc.business.create.mutationOptions({
			onSuccess: async (shop) => {
				// Both caches move: the hub decides whether to offer "Crear
				// negocio" from `users.me`, and the board reads
				// `business.myBusinesses`. No toast — the delivery step is the
				// confirmation of the ladder, and it is already on screen.
				await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
				await cache.invalidateQueries({
					queryKey: trpc.business.pathKey(),
				});
				router.replace({
					pathname: "/business-delivery",
					params: { businessId: shop.id },
				});
			},
		}),
	);
	const failure = useApiFailure(create.error);

	const waiting = useSkeletonHold(
		status === "loading" || (signedIn && categories.isPending),
	);

	const problems = useMemo(() => {
		const found: Partial<
			Record<
				"name" | "line1" | "city" | "region" | "phone" | "categoryId",
				string
			>
		> = {};
		if (!name.trim()) found.name = t("form.required");
		if (!line1.trim()) found.line1 = t("form.required");
		if (!city.trim()) found.city = t("form.required");
		if (!region.trim()) found.region = t("form.required");
		if (!categoryId) found.categoryId = t("form.required");
		const digits = (phone ?? "").replace(/\D/g, "");
		if ((phone ?? "").trim() && digits.length < MIN_PHONE_DIGITS) {
			// The words count what the check counts: digits, so the phone pair is its own
			// sentence and not the character-counting one the other fields borrow.
			found.phone = t("form.phone.tooShort", { min: MIN_PHONE_DIGITS });
		} else if (digits.length > MAX_PHONE_DIGITS) {
			found.phone = t("form.phone.tooLong", { max: MAX_PHONE_DIGITS });
		}
		return found;
	}, [name, line1, city, region, phone, categoryId, t]);

	const kindsValid = delivery || pickup;

	const submit = () => {
		if (inFlight.current) return;
		setSubmitted(true);
		const chosenId = categoryId;
		if (Object.keys(problems).length > 0 || !kindsValid || chosenId === null)
			return;
		inFlight.current = true;
		create.mutate(
			{
				name: name.trim(),
				line1: line1.trim(),
				city: city.trim(),
				region: region.trim(),
				phone: (phone ?? "").trim() || undefined,
				categoryId: chosenId,
				currency,
				deliveryEnabled: delivery,
				pickupEnabled: pickup,
			},
			{ onSettled: () => (inFlight.current = false) },
		);
	};

	const edited = (apply: () => void) => {
		apply();
		if (create.isError || create.isSuccess) create.reset();
	};

	const ready = signedIn && !waiting;
	const message = create.isError ? failure.message : null;

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the
	 * assertion on the failure line below is the whole of Android's announcement of this
	 * sentence, and iOS, which ignores the prop, has to be told. Guarded by the platform rather
	 * than announced on both: a sentence a live region has already spoken is not read twice, it
	 * is read as two sentences. It fires on the sentence changing, and `edited` resets the
	 * mutation on the next keystroke, so the announcement is once per refusal and not once per
	 * character typed after it.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !message) return;
		AccessibilityInfo.announceForAccessibility(message);
	}, [message]);

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.new.title")}
				subtitle={t("biz.new.subtitle")}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					{waiting ? (
						<NewBusinessSkeleton loadingLabel={t("state.loading")} />
					) : categories.isError ? (
						<ErrorState
							error={categories.error}
							onRetry={() => void categories.refetch()}
						/>
					) : (
						<>
							<AnimateIn index={0}>
								<Field
									label={t("biz.settings.name")}
									value={name}
									onChangeText={(value) => edited(() => setName(value))}
									onBlur={() => setBlurred((was) => ({ ...was, name: true }))}
									error={
										submitted || blurred.name ? (problems.name ?? null) : null
									}
									help={t("biz.new.name.help")}
									autoComplete="organization"
									maxLength={120}
								/>
							</AnimateIn>

							<AnimateIn index={1}>
								<ScreenSection title={t("biz.settings.address")}>
									<Field
										label={t("account.addresses.field.line1")}
										value={line1}
										onChangeText={(value) => edited(() => setLine1(value))}
										onBlur={() =>
											setBlurred((was) => ({ ...was, line1: true }))
										}
										error={
											submitted || blurred.line1
												? (problems.line1 ?? null)
												: null
										}
										placeholder={t("account.addresses.field.line1.placeholder")}
									/>
									<Field
										label={t("account.addresses.field.city")}
										value={city}
										onChangeText={(value) => edited(() => setCity(value))}
										error={submitted ? (problems.city ?? null) : null}
									/>
									<Field
										label={t("account.addresses.field.region")}
										value={region}
										onChangeText={(value) => edited(() => setRegion(value))}
										error={submitted ? (problems.region ?? null) : null}
									/>
									<Field
										label={t("biz.settings.phone")}
										value={phone ?? ""}
										onChangeText={(value) => edited(() => setPhone(value))}
										error={submitted ? (problems.phone ?? null) : null}
										keyboardType="phone-pad"
										autoComplete="tel"
									/>
								</ScreenSection>
							</AnimateIn>

							<AnimateIn index={2}>
								<ScreenSection title={t("biz.settings.category")}>
									<Text variant="caption" tone="muted">
										{t("biz.new.category.help")}
									</Text>
									<Card>
										<ListRow
											title={
												chosen
													? localizedName(chosen, locale)
													: t("biz.new.category.placeholder")
											}
											state={chosen ? t("biz.new.selected") : undefined}
											chevron
											divider={false}
											// The hint stays only where the title does not already say
											// it: with nothing chosen the title is the same sentence,
											// and a hint that repeats the label is one the row drops.
											accessibilityHint={
												chosen ? t("biz.new.category.placeholder") : undefined
											}
											onPress={() => setCategoryOpen(true)}
										/>
									</Card>
									{submitted && problems.categoryId ? (
										<Text
											variant="body"
											tone="destructive"
											accessibilityRole="alert"
										>
											{t("form.required")}
										</Text>
									) : null}
								</ScreenSection>
							</AnimateIn>

							<AnimateIn index={3}>
								<ScreenSection title={t("biz.new.currency")}>
									<Text variant="caption" tone="muted">
										{t("biz.new.currency.help")}
									</Text>
									<Card>
										<ListRow
											title={currency}
											state={t("biz.new.selected")}
											chevron
											divider={false}
											// The hint says what the row opens — a choice of currency —
											// and not the section's title again, which the row's own
											// label already carries.
											accessibilityHint={t("biz.new.currency.open")}
											onPress={() => setCurrencyOpen(true)}
										/>
									</Card>
								</ScreenSection>
							</AnimateIn>

							<AnimateIn index={4}>
								<ScreenSection title={t("biz.onboarding.step.delivery")}>
									<View style={styles.setting}>
										<Text variant="label" bold>
											{t("biz.settings.delivery.enabled")}
										</Text>
										<Segmented
											label={t("biz.settings.delivery.enabled")}
											value={delivery ? "on" : "off"}
											onChange={(value) =>
												edited(() => setDelivery(value === "on"))
											}
											options={[
												{ value: "on", label: t("settings.switch.on") },
												{ value: "off", label: t("settings.switch.off") },
											]}
										/>
									</View>
									<View style={styles.setting}>
										<Text variant="label" bold>
											{t("biz.settings.pickup.enabled")}
										</Text>
										<Segmented
											label={t("biz.settings.pickup.enabled")}
											value={pickup ? "on" : "off"}
											onChange={(value) =>
												edited(() => setPickup(value === "on"))
											}
											options={[
												{ value: "on", label: t("settings.switch.on") },
												{ value: "off", label: t("settings.switch.off") },
											]}
										/>
									</View>
									{!kindsValid && submitted ? (
										<Text
											variant="body"
											tone="destructive"
											accessibilityRole="alert"
										>
											{t("biz.new.kind.required")}
										</Text>
									) : null}
								</ScreenSection>
							</AnimateIn>

							{message ? (
								<AnimateIn index={5}>
									<Text
										variant="body"
										tone="destructive"
										accessibilityRole="alert"
										accessibilityLiveRegion="assertive"
									>
										{message}
									</Text>
								</AnimateIn>
							) : null}
						</>
					)}
				</SignedIn>
			</Screen>

			{/* The currency list, in the panel this app uses for choosing without leaving the screen. The sheet stays mounted so its exit plays; closed it renders nothing. */}
			<Sheet
				open={currencyOpen}
				onClose={() => setCurrencyOpen(false)}
				title={t("biz.new.currency")}
				closeLabel={t("action.close")}
			>
				<Card>
					{CURRENCIES.map((code, index) => {
						const selected = currency === code;
						return (
							<ListRow
								key={code}
								title={code}
								divider={index < CURRENCIES.length - 1}
								state={selected ? t("biz.new.selected") : undefined}
								trailing={
									selected ? (
										<Ionicons
											name="checkmark"
											size={icon.control}
											color={colors.action}
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									) : undefined
								}
								onPress={() => {
									// A picker settling on a value: the haptic answers the tap
									// that changes the currency, not a re-tap of the one already
									// on (`./business`'s ShopChips rule).
									if (!selected) selection();
									edited(() => setCurrency(code));
									setCurrencyOpen(false);
								}}
							/>
						);
					})}
				</Card>
			</Sheet>
			{/* The category tree, in the same panel as the currency above and reached by the
			    same kind of row: the taxonomy does not fit in the form, and the two choices are
			    made the same way. A sector is an expander, not a choice: its tap leaves the
			    panel open because it just revealed the children under it. A leaf is the
			    choice, and choosing it closes the panel. */}
			<Sheet
				open={categoryOpen}
				onClose={() => setCategoryOpen(false)}
				title={t("biz.settings.category")}
				closeLabel={t("action.close")}
			>
				<Card>
					{pickerRows.map((row, index) => {
						const selected = categoryId === row.id;
						const hasChildren = all.some((one) => one.parentId === row.id);
						return (
							<ListRow
								key={row.id}
								title={localizedName(row, locale)}
								// A child starts where its sector's name starts rather than at the
								// card's edge: the indent is the only thing on the row that says
								// which of the taxonomy's two levels it belongs to.
								leading={
									row.parentId === null ? undefined : (
										<View style={styles.indent} />
									)
								}
								divider={index < pickerRows.length - 1}
								state={selected ? t("biz.new.selected") : undefined}
								// The chevron is the affordance that says the tap opens
								// something rather than choosing it, the split list-row.tsx
								// states: a sector carries it, a leaf does not.
								chevron={hasChildren}
								accessibilityHint={
									hasChildren ? t("biz.new.category.open") : undefined
								}
								onPress={() => {
									// A sector is an expander, not a choice: the tap reveals the
									// children under it and files the shop under nothing, so the
									// panel stays open. A leaf is the choice, and it closes.
									if (hasChildren) {
										setOpenSectorId(row.id);
										return;
									}
									// The leaf is the picker settling on a value, so the haptic
									// answers the change — the sector above was an expander and
									// files nothing, so it got none.
									if (!selected) selection();
									edited(() => setCategoryId(row.id));
									setCategoryOpen(false);
								}}
							/>
						);
					})}
				</Card>
			</Sheet>
			{ready ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.new.submit"),
						onPress: submit,
						loading: create.isPending,
						disabled: create.isPending,
					}}
				/>
			) : null}
		</View>
	);
}

/**
 * The digits a shop phone has to have — the API's own bounds, restated before
 * the round trip (`@pymeshub/shared`, `phoneSchema`).
 */
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

/**
 * The hairline the `Segmented` group draws at `borderWidth: 1` — the same two points
 * `./skeletons`' private `HAIRLINE` counts into the control boxes it mirrors, restated
 * here because that constant is not exported.
 */
const HAIRLINE = 1;

/** The address section's four fields, named so a key never falls to array position. */
const SKELETON_ADDRESS_FIELDS = ["line1", "city", "region", "phone"] as const;
const SKELETON_SETTINGS = ["delivery", "pickup"] as const;

/**
 * The wait, in the loaded form's own shape — the way `./product-form`'s `FormSkeleton`
 * draws its form, because these two screens are one ladder and their waits should read
 * alike.
 *
 * The name field and the address section's four fields draw `./field`'s triple — label,
 * box, message line — and the category and currency sections draw their own copy real
 * (`ScreenSection`'s title and the caption under it), with only the card's row grey. The
 * delivery section draws its two `Segmented` groups at the group's own sum: the segment's
 * `space.sm` of vertical padding twice and the group's hairline twice, over
 * `MIN_TOUCH_TARGET`, at the label's line height. Every text height goes through
 * `./skeletons`' `line()` at the reader's `fontScale` — a height frozen at 100% metrics is
 * exact at 100% and short of the real form at 200% by the growth of its own lines.
 * `Skeleton`'s `label` on the first line is the one announcement for the whole wait.
 */
function NewBusinessSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// One `./list-row`: the card row's `space.md` of vertical padding twice around its
	// title's `body` line, over the row's own touch floor — the box the closed row pays.
	const cardRow = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 + line("body", fontScale).height,
	);

	// One `Segmented` group: the segment's `space.sm` of vertical padding twice and the
	// group's hairline twice, over the touch floor, at the label's line height.
	const segmented = Math.max(
		MIN_TOUCH_TARGET,
		HAIRLINE * 2 + space.sm * 2 + line("label", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<View style={formStyles.field}>
				<Skeleton
					label={loadingLabel}
					style={[formStyles.label, line("label", fontScale)]}
				/>
				<Skeleton style={formStyles.input} />
				<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
			</View>

			<ScreenSection title={t("biz.settings.address")}>
				{SKELETON_ADDRESS_FIELDS.map((field) => (
					<View key={field} style={formStyles.field}>
						<Skeleton style={[formStyles.label, line("label", fontScale)]} />
						<Skeleton style={formStyles.input} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				))}
			</ScreenSection>

			<ScreenSection title={t("biz.settings.category")}>
				<Skeleton
					style={[styles.skeletonCaption, line("caption", fontScale)]}
				/>
				<Card>
					<Skeleton style={{ height: cardRow }} />
				</Card>
			</ScreenSection>

			<ScreenSection title={t("biz.new.currency")}>
				<Skeleton
					style={[styles.skeletonCaption, line("caption", fontScale)]}
				/>
				<Card>
					<Skeleton style={{ height: cardRow }} />
				</Card>
			</ScreenSection>

			<ScreenSection title={t("biz.onboarding.step.delivery")}>
				{SKELETON_SETTINGS.map((setting) => (
					<View key={setting} style={styles.setting}>
						<Skeleton
							style={[styles.skeletonSettingLabel, line("label", fontScale)]}
						/>
						<Skeleton
							style={{
								height: segmented,
								borderRadius: radius.sm,
							}}
						/>
					</View>
				))}
			</ScreenSection>
		</View>
	);
}

/**
 * The grey field's own rows — `./field`'s wrap gap between the label, the box and the
 * message row (`components/field.tsx`'s `wrap`), the box at the floor the real input pays,
 * the widths shares for words the read does not carry. The same set `./product-form`'s
 * form skeleton draws, restated here because that file's is private to it.
 */
const formStyles = StyleSheet.create({
	field: { gap: space.sm },
	label: { width: "35%" },
	input: { minHeight: MIN_TOUCH_TARGET },
	message: { width: "60%" },
});

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	setting: { gap: space.sm, marginBottom: space.md },
	// Widths, not measures: the help sentence and the toggle's word arrive with the read.
	// The heights come from `line()` in the component — a line height cannot live down here.
	skeletonCaption: { width: "70%" },
	skeletonSettingLabel: { width: "40%" },
	// One step of the scale, which is what `ListRow`'s own gap pays between its parts — a
	// child under its sector reads as one level in without becoming a different row.
	indent: { width: space.lg },
});

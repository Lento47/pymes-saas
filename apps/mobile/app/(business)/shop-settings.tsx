import Ionicons from "@expo/vector-icons/Ionicons";
import { localizedName } from "@pymeshub/i18n";
import { sinpeAccountInput } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { MerchantDeliverySettings } from "@/components/merchant-delivery-settings";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Switch } from "@/components/switch";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { categoryPickerRows, indentFor } from "@/lib/category-scope";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import {
	type DeliveryDraft,
	deliveryDraft,
	deliveryUpdate,
} from "@/lib/merchant-delivery-settings";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { icon, MIN_TOUCH_TARGET, radius, space, useTheme } from "@/theme";

/** One settings editor. Photos stay in Personalization and hours in the schedule. */
export default function ShopSettings() {
	const { t, locale } = useT();
	const { colors } = useTheme();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const toast = useToast();
	const scope = useMerchantScope();

	// The same resolution `app/(business)/locations.tsx` makes: the branch the
	// operator picked, falling back to the first shop they own. `businessId` is
	// optional on the scope — nothing pins it until a tab has been switched — and
	// this screen is reached from the menu tab, which navigates without a parameter.
	// Reading a parameter instead would bounce a merchant straight back out of the
	// screen they just asked for.
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shopList = (shops.data ?? []).filter((one) => one.role !== "COURIER");
	const shop =
		shopList.find((one) => one.businessId === scope.businessId) ?? shopList[0];
	const businessId = shop?.businessId ?? "";
	const canManage = shop?.role === "OWNER" || shop?.role === "MANAGER";
	const paymentAccount = useQuery(
		trpc.orders.paymentAccount.queryOptions(
			{ businessId },
			{ enabled: Boolean(businessId) },
		),
	);

	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId },
			{ enabled: businessId.length > 0 },
		),
	);
	const categories = useQuery(trpc.catalog.categories.queryOptions());

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState<string | null>(null);
	const [phone, setPhone] = useState("");
	const [sinpeEnabled, setSinpeEnabled] = useState(false);
	const [recipientName, setRecipientName] = useState("");
	const [descriptionOpen, setDescriptionOpen] = useState(false);
	const [contactOpen, setContactOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [line1, setLine1] = useState("");
	const [line2, setLine2] = useState("");
	const [city, setCity] = useState("");
	const [region, setRegion] = useState("");
	const [postalCode, setPostalCode] = useState("");
	const [country, setCountry] = useState("CR");
	const [expandedSection, setExpandedSection] = useState<
		"profile" | "contact" | "address" | "delivery" | null
	>(null);
	const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
	const [deliveryDirty, setDeliveryDirty] = useState(false);
	const [editingAddress, setEditingAddress] = useState(false);
	const [addressOpen, setAddressOpen] = useState(false);
	const [categoryOpen, setCategoryOpen] = useState(false);
	const [openSectorId, setOpenSectorId] = useState<string | undefined>(
		undefined,
	);
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const prefilled = useRef<string | null>(null);
	const paymentPrefilled = useRef<string | null>(null);

	const update = useMutation(trpc.business.update.mutationOptions());
	const status = useMutation(
		trpc.business.setStatus.mutationOptions({
			onSuccess: async () => {
				await cache.invalidateQueries({ queryKey: trpc.business.pathKey() });
				toast.show(t("biz.settings.saved"));
			},
		}),
	);
	const failure = useApiFailure(update.error ?? status.error);

	// `isLoading`, not `isPending`: `settings` is `enabled: businessId.length > 0`,
	// and a disabled query reports `isPending` forever — which would hold the
	// skeleton up on a membership that has not resolved yet rather than on the
	// network. `shops` is always enabled, so its `isPending` is already the truth.
	const waiting = useSkeletonHold(shops.isPending || settings.isLoading);

	// The boxes, once: an empty box that meant "unchanged" would save "" over a
	// real name, so the fields open holding what the server has. Once, because a
	// refetch after the save must not stomp typing.
	//
	useEffect(() => {
		if (
			prefilled.current === businessId ||
			!settings.data ||
			settings.data.id !== businessId
		)
			return;
		prefilled.current = businessId;
		setSubmitted(false);
		setDescriptionOpen(false);
		setContactOpen(false);
		setEditingAddress(false);
		setAddressOpen(false);
		setExpandedSection(null);
		setDelivery(deliveryDraft(settings.data));
		setDeliveryDirty(false);
		setName(settings.data.name);
		setDescription(settings.data.description ?? "");
		setCategoryId(settings.data.categoryId);
		setPhone(settings.data.phone ?? "");
		setEmail(settings.data.email ?? "");
		setLine1(settings.data.line1);
		setLine2(settings.data.line2 ?? "");
		setCity(settings.data.city);
		setRegion(settings.data.region);
		setPostalCode(settings.data.postalCode ?? "");
		setCountry(settings.data.country);
	}, [businessId, settings.data]);
	useEffect(() => {
		if (paymentPrefilled.current === businessId || !paymentAccount.data) return;
		paymentPrefilled.current = businessId;
		setSinpeEnabled(Boolean(paymentAccount.data.account));
		setRecipientName(paymentAccount.data.account?.recipientName ?? "");
	}, [businessId, paymentAccount.data]);

	/*
	 * The taxonomy is two levels — 18 sectors and their 224 children — and a
	 * panel cannot draw 242 rows, so it draws the sectors and expands one. The
	 * expansion is the reader's and not the choice's: a sector is an expander
	 * rather than a choice, so tapping one has to open it without filing the
	 * shop under anything. It falls back to the sector of the category already
	 * chosen, so the panel reopens on the branch the shop is filed under instead
	 * of on all eighteen sectors level with each other.
	 */
	const all = categories.data ?? [];
	const chosen = all.find((one) => one.id === categoryId);
	const expandedSectorId = openSectorId ?? chosen?.parentId ?? undefined;
	const pickerRows = categoryPickerRows(all, {
		// `null` on purpose — see the file docblock. The merchant is here to move
		// the shop to another vertical, and `categoryPickerRows` scopes a picker to
		// the vertical it is given, which would leave no way out of the current one.
		businessCategoryId: null,
		chosenId: categoryId,
		openSectorId: expandedSectorId,
	});

	// The three a shop cannot exist without, and the two shapes a contact detail
	// can be wrong in. Only the fields that can *fail* appear here: the ceilings
	// on `description`, `line2` and `postalCode` are enforced by the box itself
	// (`maxLength`), so a message under them would be one the merchant can never
	// see. `name`'s ceiling is not in `problems` either — it is `help` beside the
	// box, where the merchant reads it before typing rather than after failing.
	const problems = useMemo(() => {
		const found: Partial<
			Record<
				| "name"
				| "categoryId"
				| "phone"
				| "email"
				| "line1"
				| "city"
				| "region"
				| "country"
				| "recipientName",
				string
			>
		> = {};
		if (!name.trim()) found.name = t("form.required");
		if (!categoryId) found.categoryId = t("form.required");
		if (editingAddress && !line1.trim()) found.line1 = t("form.required");
		if (editingAddress && !city.trim()) found.city = t("form.required");
		if (editingAddress && !region.trim()) found.region = t("form.required");
		if (editingAddress && country.trim().length !== 2)
			found.country = t("biz.settings.country.invalid");
		// The words count what the check counts: digits, so the phone pair is its
		// own sentence and not the character-counting one the other fields borrow.
		const digits = phone.replace(/\D/g, "");
		if (phone.trim() && digits.length < MIN_PHONE_DIGITS) {
			found.phone = t("form.phone.tooShort", { min: MIN_PHONE_DIGITS });
		} else if (digits.length > MAX_PHONE_DIGITS) {
			found.phone = t("form.phone.tooLong", { max: MAX_PHONE_DIGITS });
		}
		if (email.trim() && !EMAIL_SHAPE.test(email.trim())) {
			found.email = t("form.invalidEmail");
		}
		if (sinpeEnabled) {
			const parsed = sinpeAccountInput.safeParse({
				phone: phone.replace(/[^\d+]/g, ""),
				recipientName,
			});
			if (!parsed.success) {
				for (const issue of parsed.error.issues) {
					if (issue.path[0] === "phone")
						found.phone = t("biz.settings.sinpe.phoneInvalid");
					else found.recipientName = t("biz.settings.sinpe.nameHelp");
				}
			}
		}
		return found;
	}, [
		name,
		categoryId,
		line1,
		city,
		region,
		country,
		editingAddress,
		phone,
		email,
		sinpeEnabled,
		recipientName,
		t,
	]);

	const deliveryResult =
		delivery && settings.data
			? deliveryUpdate(
					delivery,
					settings.data.currency,
					Boolean(settings.data.canSetDeliveryFee),
				)
			: null;
	const deliveryErrors = Object.fromEntries(
		Object.entries(deliveryResult?.errors ?? {}).map(([key, message]) => [
			key,
			t(message),
		]),
	);
	const submit = () => {
		if (
			update.isPending ||
			status.isPending ||
			!canManage ||
			!paymentAccount.isSuccess
		)
			return;
		setSubmitted(true);
		if (problems.email) setContactOpen(true);
		if (problems.line1 || problems.city || problems.region)
			setAddressOpen(true);
		if (problems.name || problems.categoryId) setExpandedSection("profile");
		else if (problems.phone || problems.email || problems.recipientName)
			setExpandedSection("contact");
		else if (
			problems.line1 ||
			problems.city ||
			problems.region ||
			problems.country
		) {
			setExpandedSection("address");
			setAddressOpen(true);
		} else if (deliveryDirty && Object.keys(deliveryErrors).length > 0)
			setExpandedSection("delivery");
		if (
			Object.keys(problems).length > 0 ||
			(deliveryDirty && Object.keys(deliveryErrors).length > 0)
		)
			return;
		setSaving(true);
		update.mutate(
			{
				businessId,
				name: name.trim(),
				// `""` clears the description and `undefined` leaves it, so an emptied
				// box is sent as an empty string rather than omitted — the write
				// `app/(business)/product-form.tsx` makes for the same field.
				description: description.trim(),
				// Always a leaf: `assertLeafCategory` refuses a sector, and this panel
				// only ever offers leaves as choices (see the row's `onPress`).
				categoryId: categoryId ?? "",
				// `null` clears, a string sets, `undefined` would leave it — see the
				// file docblock on why an emptied contact box is a write and not a
				// no-op.
				phone: phone.trim() || null,
				sinpeAccount: sinpeEnabled
					? { recipientName: recipientName.trim() }
					: null,
				email: email.trim() || null,
				...(deliveryDirty ? deliveryResult?.data : {}),
				...(editingAddress
					? {
							line1: line1.trim(),
							line2: line2.trim(),
							city: city.trim(),
							region: region.trim(),
							postalCode: postalCode.trim(),
							country: country.trim().toUpperCase(),
						}
					: {}),
			},
			{
				onSuccess: async () => {
					setSaving(false);
					setDeliveryDirty(false);
					toast.show(t("biz.settings.saved"));
					await Promise.all([
						cache.invalidateQueries({ queryKey: trpc.business.pathKey() }),
						cache.invalidateQueries({ queryKey: trpc.orders.pathKey() }),
						cache.invalidateQueries({
							queryKey: trpc.cart.paymentMethods.queryKey(),
						}),
					]);
				},
				onError: () => setSaving(false),
			},
		);
	};

	const edited = (apply: () => void) => {
		apply();
		if (update.isError) update.reset();
	};
	const toggleAddress = () => {
		if (!addressOpen && !editingAddress && settings.data) {
			setLine1(settings.data.line1);
			setLine2(settings.data.line2 ?? "");
			setCity(settings.data.city);
			setRegion(settings.data.region);
			setPostalCode(settings.data.postalCode ?? "");
			setCountry(settings.data.country);
		}
		setAddressOpen(!addressOpen);
	};

	const failed = shops.error ?? settings.error;
	const ready = businessId.length > 0 && !!settings.data && !waiting;

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.settings.configuration")}
				leading={<BackButton to="/(business)/menu" />}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					{waiting ? (
						<ShopSettingsSkeleton loadingLabel={t("state.loading")} />
					) : failed ? (
						<ErrorState
							error={failed}
							onRetry={() => {
								void shops.refetch();
								void settings.refetch();
							}}
						/>
					) : settings.data ? (
						<>
							{!canManage ? (
								<Text tone="muted">{t("biz.settings.readOnly")}</Text>
							) : null}
							<AnimateIn index={0}>
								<Card elevation="flat" style={styles.accordionCard}>
									<SettingsFold
										primary
										label={t("biz.settings.profile")}
										detail={name}
										open={expandedSection === "profile"}
										onToggle={() =>
											setExpandedSection(
												expandedSection === "profile" ? null : "profile",
											)
										}
									>
										<Field
											label={t("biz.settings.name")}
											value={name}
											onChangeText={(value) => edited(() => setName(value))}
											error={submitted ? problems.name : undefined}
											maxLength={120}
											editable={canManage}
										/>
										<ListRow
											title={t("biz.settings.category")}
											subtitle={
												chosen
													? localizedName(chosen, locale)
													: t("biz.new.category.placeholder")
											}
											onPress={
												canManage ? () => setCategoryOpen(true) : undefined
											}
											chevron={canManage}
											divider={false}
										/>
										{submitted && problems.categoryId ? (
											<Text
												variant="caption"
												tone="destructive"
												accessibilityRole="alert"
											>
												{problems.categoryId}
											</Text>
										) : null}
										<SettingsFold
											label={t("biz.settings.description")}
											open={descriptionOpen}
											onToggle={() => setDescriptionOpen(!descriptionOpen)}
										>
											<Field
												label={t("biz.settings.description")}
												value={description}
												onChangeText={(value) =>
													edited(() => setDescription(value))
												}
												multiline
												maxLength={600}
												editable={canManage}
											/>
										</SettingsFold>
										<Text variant="caption" tone="muted">
											{t("biz.settings.currency")} · {settings.data.currency}
										</Text>
										{shop?.role === "OWNER" ? (
											<>
												<Text variant="caption" tone="muted">
													{t(`biz.status.${settings.data.status}`)}
												</Text>
												<Button
													variant="secondary"
													label={t(
														settings.data.status === "ACTIVE"
															? "biz.settings.pause"
															: "biz.settings.publish",
													)}
													loading={status.isPending}
													disabled={saving}
													onPress={() =>
														status.mutate({
															businessId,
															status:
																settings.data?.status === "ACTIVE"
																	? "CLOSED"
																	: "ACTIVE",
														})
													}
												/>
											</>
										) : null}
									</SettingsFold>
								</Card>
							</AnimateIn>

							<AnimateIn index={1}>
								<Card elevation="flat" style={styles.accordionCard}>
									<SettingsFold
										primary
										label={t("biz.settings.contactPayments")}
										detail={phone || t("biz.settings.phone")}
										open={expandedSection === "contact"}
										onToggle={() =>
											setExpandedSection(
												expandedSection === "contact" ? null : "contact",
											)
										}
									>
										<Field
											label={t("biz.settings.phone")}
											value={phone}
											onChangeText={(value) => edited(() => setPhone(value))}
											error={submitted ? problems.phone : undefined}
											keyboardType="phone-pad"
											autoComplete="tel"
											maxLength={24}
											editable={canManage}
										/>
										{paymentAccount.isPending ? (
											<Text variant="caption" tone="muted">
												{t("state.loading")}
											</Text>
										) : paymentAccount.isError ? (
											<ErrorState
												error={paymentAccount.error}
												onRetry={() => void paymentAccount.refetch()}
											/>
										) : (
											<View
												style={[
													styles.sinpe,
													{
														backgroundColor: colors.background,
														borderColor: colors.border,
													},
												]}
											>
												<View style={styles.sinpeRow}>
													<View style={styles.sinpeText}>
														<Text variant="body" bold>
															{t("biz.settings.sinpe.enable")}
														</Text>
														<Text variant="caption" tone="muted">
															{t("biz.settings.sinpe.phoneHelp")}
														</Text>
													</View>
													<Switch
														checked={sinpeEnabled}
														onChange={(next) =>
															edited(() => setSinpeEnabled(next))
														}
														label={t("biz.settings.sinpe.enable")}
														disabled={!canManage || saving}
													/>
												</View>
												{sinpeEnabled ? (
													<View style={styles.sinpeFields}>
														<Text variant="label" bold>
															{phone.trim()
																? t("biz.settings.sinpe.number", {
																		phone: phone.trim(),
																	})
																: t("biz.settings.sinpe.phoneInvalid")}
														</Text>
														<Field
															label={t("payments.accountName")}
															value={recipientName}
															onChangeText={(value) =>
																edited(() => setRecipientName(value))
															}
															error={
																submitted ? problems.recipientName : undefined
															}
															help={t("biz.settings.sinpe.nameHelp")}
															maxLength={120}
															editable={canManage}
														/>
													</View>
												) : null}
											</View>
										)}
										<SettingsFold
											label={t("biz.settings.email")}
											detail={email || t("form.optional")}
											open={contactOpen}
											onToggle={() => setContactOpen(!contactOpen)}
										>
											<Field
												label={t("biz.settings.email")}
												value={email}
												onChangeText={(value) => edited(() => setEmail(value))}
												error={submitted ? problems.email : undefined}
												keyboardType="email-address"
												autoComplete="email"
												autoCapitalize="none"
												maxLength={200}
												editable={canManage}
											/>
										</SettingsFold>
									</SettingsFold>
								</Card>
							</AnimateIn>

							<AnimateIn index={2}>
								<Card elevation="flat" style={styles.accordionCard}>
									<SettingsFold
										primary
										label={t("biz.settings.address")}
										detail={settings.data.city}
										open={expandedSection === "address"}
										onToggle={() =>
											setExpandedSection(
												expandedSection === "address" ? null : "address",
											)
										}
									>
										<ListRow
											title={t("biz.order.dispatch.setPickupPin")}
											subtitle={[
												settings.data.line1,
												settings.data.city,
												settings.data.region,
											]
												.filter(Boolean)
												.join(", ")}
											leading={
												<Ionicons
													name="location-outline"
													size={icon.control}
													color={colors.action}
													accessibilityElementsHidden
													importantForAccessibility="no"
												/>
											}
											onPress={
												canManage
													? () => router.push("/(business)/shop-location")
													: undefined
											}
											chevron={canManage}
											divider={false}
										/>
										<SettingsFold
											label={t("biz.settings.address.editManually")}
											open={addressOpen}
											onToggle={toggleAddress}
										>
											<Field
												label={t("biz.settings.line1")}
												value={line1}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setLine1(value);
													})
												}
												error={submitted ? problems.line1 : undefined}
												maxLength={200}
												editable={canManage}
											/>
											<Field
												label={t("biz.settings.line2")}
												value={line2}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setLine2(value);
													})
												}
												maxLength={200}
												editable={canManage}
											/>
											<Field
												label={t("biz.settings.city")}
												value={city}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setCity(value);
													})
												}
												error={submitted ? problems.city : undefined}
												maxLength={80}
												editable={canManage}
											/>
											<Field
												label={t("biz.settings.region")}
												value={region}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setRegion(value);
													})
												}
												error={submitted ? problems.region : undefined}
												maxLength={80}
												editable={canManage}
											/>
											<Field
												label={t("biz.settings.country")}
												value={country}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setCountry(value.toUpperCase());
													})
												}
												error={submitted ? problems.country : undefined}
												maxLength={2}
												autoCapitalize="characters"
												editable={canManage}
											/>
											<Field
												label={t("biz.settings.postalCode")}
												value={postalCode}
												onChangeText={(value) =>
													edited(() => {
														setEditingAddress(true);
														setPostalCode(value);
													})
												}
												maxLength={16}
												editable={canManage}
											/>
										</SettingsFold>
									</SettingsFold>
								</Card>
							</AnimateIn>
							<AnimateIn index={3}>
								<Card elevation="flat" style={styles.accordionCard}>
									<SettingsFold
										primary
										label={t("biz.settings.fulfillment")}
										detail={[
											delivery?.deliveryEnabled
												? t("biz.settings.delivery")
												: null,
											delivery?.pickupEnabled ? t("biz.settings.pickup") : null,
										]
											.filter(Boolean)
											.join(" · ")}
										open={expandedSection === "delivery"}
										onToggle={() =>
											setExpandedSection(
												expandedSection === "delivery" ? null : "delivery",
											)
										}
									>
										{delivery ? (
											<MerchantDeliverySettings
												value={delivery}
												onChange={(next) =>
													edited(() => {
														setDelivery(next);
														setDeliveryDirty(true);
													})
												}
												errors={submitted ? deliveryErrors : {}}
												canSetDeliveryFee={Boolean(
													settings.data.canSetDeliveryFee,
												)}
												disabled={!canManage || saving}
												currency={settings.data.currency}
											/>
										) : null}
									</SettingsFold>
								</Card>
							</AnimateIn>
							{failure.message ? (
								<AnimateIn index={4}>
									<Text
										variant="body"
										tone="destructive"
										accessibilityRole="alert"
										accessibilityLiveRegion="assertive"
									>
										{failure.message}
									</Text>
								</AnimateIn>
							) : null}
						</>
					) : null}
				</SignedIn>
			</Screen>

			{/* The taxonomy, in the panel this app uses for choosing without leaving
			    the screen. A sibling of `Screen` rather than a child of it: a sheet
			    mounted inside a scroll view is laid out in its content and scrolls
			    away with it. The sheet stays mounted so its exit plays; closed it
			    renders nothing. */}
			<Sheet
				open={categoryOpen}
				onClose={() => setCategoryOpen(false)}
				title={t("biz.settings.category")}
				closeLabel={t("action.close")}
			>
				<Card>
					{pickerRows.map((row, index) => {
						const selected = categoryId === row.id;
						// Children, not "has a parent": the seed's flat roots are their own
						// leaf and a sector with nothing under it is not an expander. This
						// is the same test `app/new-business.tsx` makes on the day the shop
						// is created, and the two panels answer to the same rule.
						const hasChildren = all.some((one) => one.parentId === row.id);
						return (
							<ListRow
								key={row.id}
								title={localizedName(row, locale)}
								// A child starts where its sector's name starts rather than at
								// the card's edge: the indent is the only thing on the row that
								// says which of the taxonomy's two levels it belongs to.
								leading={
									indentFor(pickerRows, row) ? (
										<View style={styles.indent} />
									) : undefined
								}
								divider={index < pickerRows.length - 1}
								state={selected ? t("biz.new.selected") : undefined}
								// The chevron is the affordance that says the tap opens
								// something rather than choosing it, the split `list-row.tsx`
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

			{ready && canManage ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.settings.save"),
						onPress: submit,
						loading: saving,
						disabled: saving || status.isPending || !paymentAccount.isSuccess,
					}}
				/>
			) : null}
		</View>
	);
}

/** Optional fields stay folded, with expansion announced to screen readers. */
function SettingsFold({
	primary = false,
	label,
	detail,
	open,
	onToggle,
	children,
}: {
	primary?: boolean;
	label: string;
	detail?: string;
	open: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	const { colors } = useTheme();
	return (
		<View style={styles.fold}>
			<Pressable
				onPress={onToggle}
				scaleTo={1}
				accessibilityRole="button"
				accessibilityLabel={detail && !open ? `${label}, ${detail}` : label}
				accessibilityState={{ expanded: open }}
				style={[
					styles.foldButton,
					primary && styles.primaryFoldButton,
					primary && !open && styles.closedFoldButton,
				]}
			>
				<View style={styles.sinpeText}>
					<Text
						variant={primary ? "body" : "label"}
						tone={primary ? undefined : "muted"}
						bold={primary}
					>
						{label}
					</Text>
					{detail && !open ? (
						<Text variant="caption" tone="muted">
							{detail}
						</Text>
					) : null}
				</View>
				<Ionicons
					name={open ? "chevron-up" : "chevron-down"}
					size={icon.inline}
					color={colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</Pressable>
			{open ? (
				<View style={[styles.section, primary && styles.accordionBody]}>
					{children}
				</View>
			) : null}
		</View>
	);
}

function ShopSettingsSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	return (
		<View style={styles.content}>
			{[0, 1, 2, 3].map((index) => (
				<Card key={index} elevation="flat" style={styles.section}>
					<Skeleton
						label={index === 0 ? loadingLabel : undefined}
						style={{ ...line("heading", fontScale), width: "55%" }}
					/>
					<Skeleton style={{ ...line("label", fontScale), width: "75%" }} />
				</Card>
			))}
		</View>
	);
}

/** Same shape check as the profile form and `app/new-business.tsx`: worth stopping for, not a full RFC. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The phone's digit counts, restated from `phoneSchema` so the field fails here rather than after the round trip. */
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg, paddingTop: space.md },
	section: { gap: space.md },
	accordionCard: { padding: 0 },
	accordionBody: { paddingHorizontal: space.lg, paddingBottom: space.lg },
	sinpe: {
		padding: space.md,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		gap: space.sm,
	},
	sinpeRow: { flexDirection: "row", alignItems: "center", gap: space.md },
	sinpeText: { flex: 1, gap: space.xs },
	sinpeFields: { gap: space.md, paddingTop: space.sm },
	fold: { gap: space.sm },
	foldButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.sm,
	},
	// Keep the full-width header inside its card's bounds during expand/collapse.
	primaryFoldButton: {
		paddingHorizontal: space.lg,
		paddingTop: space.lg + space.sm,
		borderRadius: radius.md,
		borderBottomLeftRadius: 0,
		borderBottomRightRadius: 0,
	},
	closedFoldButton: {
		paddingBottom: space.lg + space.sm,
		borderBottomLeftRadius: radius.md,
		borderBottomRightRadius: radius.md,
	},
	// One step of the scale, applied only to a row whose parent is also on the
	// list (`indentFor`). Unscoped here, the sector is present and its children
	// step in under it. This is air, never a second row shape.
	indent: { width: space.lg },
});

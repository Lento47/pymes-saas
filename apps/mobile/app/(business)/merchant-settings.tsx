import { localizedName, weekdayName } from "@pymeshub/i18n";
import {
	type BusinessHoursEntry,
	type BusinessSettings,
	type Category,
	currencyExponent,
	DAYS_OF_WEEK,
	type MembershipRole,
	parseMoney,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { ManagementEmpty } from "@/components/merchant-management-ui";
import { PhotoPicker } from "@/components/photo-picker";
import { Screen, ScreenSection } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Sheet } from "@/components/sheet";
import { Spinner } from "@/components/spinner";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { radius, space, type } from "@/theme";

type SettingsForm = {
	name: string;
	categoryId: string | null;
	description: string;
	phone: string;
	email: string;
	/**
	 * `string | null` and not `string`.
	 *
	 * These two are `/files/:id` paths written by `./photo-picker` and read by
	 * nothing a human types, so the only two states a merchant can put them in are
	 * "a picture" and "no picture". `null` *is* the second one, and pretending
	 * otherwise is what made these two a pair of text boxes asking an OWNER to
	 * paste a URL — a box whose wrong answer is a broken image on every storefront
	 * card, and whose right answer requires knowing an internal path shape.
	 */
	logoUrl: string | null;
	coverUrl: string | null;
	line1: string;
	line2: string;
	city: string;
	region: string;
	country: string;
	postalCode: string;
	deliveryEnabled: boolean;
	pickupEnabled: boolean;
	deliveryFeeMinor: string;
	merchantCoversDelivery: boolean;
	deliveryRadiusKm: string;
	prepTimeMinutes: string;
	minOrderMinor: string;
	hours: BusinessHoursEntry[];
};

type FieldErrors = Partial<Record<keyof SettingsForm, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The logo circle's diameter, and the one measurement the composed brand block reads
 * three times: the preview's own box, the padding that reserves the half of it which
 * hangs below the portada, and the negative margin that lifts it onto the portada's
 * edge.
 *
 * 72 rather than `./photo-picker`'s own `media.row` (60): a mark that overlaps a
 * photograph has to be big enough to read against that photograph, and `media.row`
 * is sized for a product thumbnail in a list row beside its name — a job where the
 * image is never behind anything. Named here rather than inlined three times, because
 * the three uses are the *same* length and a block that is 70% padding and 30%
 * mark is a layout accident waiting to be retuned in one place only.
 */
const BRAND_LOGO = 72;

function moneyInput(
	value: number,
	currency: BusinessSettings["currency"],
): string {
	if (value === 0) return "";
	return (value / 10 ** currencyExponent(currency)).toFixed(
		currencyExponent(currency),
	);
}

function moneyValue(
	value: string,
	currency: BusinessSettings["currency"],
): number {
	if (!value.trim()) return 0;
	return parseMoney(value, currency) ?? 0;
}

function numberValue(value: string): number | undefined {
	const parsed = Number(value.replace(",", "."));
	return Number.isFinite(parsed) ? parsed : undefined;
}

function minuteInput(minute: number): string {
	if (minute === 1440) return "24:00";
	const hours = Math.floor(minute / 60) % 24;
	const minutes = minute % 60;
	return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function minuteValue(value: string): number | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if ((hours === 24 && minutes !== 0) || hours > 24 || minutes > 59) {
		return null;
	}
	return hours === 24 ? 1440 : hours * 60 + minutes;
}

function initialForm(settings: BusinessSettings): SettingsForm {
	return {
		name: settings.name,
		categoryId: settings.categoryId,
		description: settings.description ?? "",
		phone: settings.phone ?? "",
		email: settings.email ?? "",
		logoUrl: settings.logoUrl ?? null,
		coverUrl: settings.coverUrl ?? null,
		line1: settings.line1,
		line2: settings.line2 ?? "",
		city: settings.city,
		region: settings.region ?? "",
		country: settings.country,
		postalCode: settings.postalCode ?? "",
		deliveryEnabled: settings.deliveryEnabled,
		pickupEnabled: settings.pickupEnabled,
		deliveryFeeMinor: moneyInput(settings.deliveryFeeMinor, settings.currency),
		merchantCoversDelivery: settings.merchantCoversDelivery ?? false,
		deliveryRadiusKm: settings.deliveryRadiusKm?.toString() ?? "",
		prepTimeMinutes: settings.prepTimeMinutes.toString(),
		minOrderMinor: moneyInput(settings.minOrderMinor, settings.currency),
		hours: settings.hours.map((entry) => ({ ...entry })),
	};
}

function validate(
	form: SettingsForm,
	currency: BusinessSettings["currency"],
	t: ReturnType<typeof useT>["t"],
): FieldErrors {
	const errors: FieldErrors = {};
	if (!form.name.trim()) errors.name = t("form.required");
	if (!form.categoryId) errors.categoryId = t("form.required");
	if (!form.line1.trim()) errors.line1 = t("form.required");
	if (!form.city.trim()) errors.city = t("form.required");
	if (!form.region.trim()) errors.region = t("form.required");
	if (form.country.trim().length !== 2) {
		errors.country = t("biz.settings.country.invalid");
	}
	if (form.email.trim() && !EMAIL.test(form.email.trim())) {
		errors.email = t("form.invalidEmail");
	}
	for (const key of ["deliveryFeeMinor", "minOrderMinor"] as const) {
		const parsed = form[key].trim() ? parseMoney(form[key], currency) : 0;
		const max = key === "deliveryFeeMinor" ? 10_000_000 : 100_000_000;
		if (parsed === null || parsed < 0 || parsed > max) {
			errors[key] = t("biz.new.amount.unreadable");
		}
	}
	if (
		!errors.deliveryFeeMinor &&
		form.deliveryEnabled &&
		moneyValue(form.deliveryFeeMinor, currency) <= 0
	) {
		errors.deliveryFeeMinor = t("biz.settings.delivery.courierFeeRequired");
	}
	if (
		form.deliveryRadiusKm.trim() &&
		(!Number.isFinite(Number(form.deliveryRadiusKm.replace(",", "."))) ||
			Number(form.deliveryRadiusKm.replace(",", ".")) < 0 ||
			Number(form.deliveryRadiusKm.replace(",", ".")) > 80)
	) {
		errors.deliveryRadiusKm = t("biz.new.number.unreadable");
	}
	if (
		form.prepTimeMinutes.trim() &&
		(!Number.isInteger(Number(form.prepTimeMinutes)) ||
			Number(form.prepTimeMinutes) < 0 ||
			Number(form.prepTimeMinutes) > 600)
	) {
		errors.prepTimeMinutes = t("biz.new.number.unreadable");
	}
	for (const entry of form.hours) {
		if (entry.isClosed) continue;
		if (entry.opensMinute >= entry.closesMinute) {
			errors.hours = t("biz.new.number.unreadable");
		}
	}
	return errors;
}

function asSettingsUpdate(
	form: SettingsForm,
	currency: BusinessSettings["currency"],
) {
	return {
		name: form.name.trim(),
		categoryId: form.categoryId ?? undefined,
		description: form.description.trim() || undefined,
		phone: form.phone.trim() || undefined,
		email: form.email.trim() || undefined,
		line1: form.line1.trim(),
		line2: form.line2.trim() || undefined,
		city: form.city.trim(),
		region: form.region.trim() || undefined,
		country: form.country.trim(),
		postalCode: form.postalCode.trim() || undefined,
		// Sent as-is rather than `form.logoUrl.trim() || null`: the value is a stored
		// `/files/:id`, `null` is the picker's own "removed", and there is no third
		// state a `trim()` could have been collapsing. `businessUpdateInput` widens both
		// to `.nullable().optional()` for exactly this write.
		logoUrl: form.logoUrl,
		coverUrl: form.coverUrl,
		deliveryEnabled: form.deliveryEnabled,
		pickupEnabled: form.pickupEnabled,
		deliveryFeeMinor: moneyValue(form.deliveryFeeMinor, currency),
		merchantCoversDelivery: form.merchantCoversDelivery,
		deliveryRadiusKm: numberValue(form.deliveryRadiusKm),
		prepTimeMinutes: numberValue(form.prepTimeMinutes) ?? 0,
		minOrderMinor: moneyValue(form.minOrderMinor, currency),
		hours: form.hours,
	};
}

export default function MerchantSettingsScreen() {
	const trpc = useTRPC();
	const { t } = useT();
	const merchantScope = useMerchantScope();
	const shops = useQuery(trpc.business.myBusinesses.queryOptions());
	const shop =
		shops.data?.find(
			(one) =>
				one.role !== "COURIER" && one.businessId === merchantScope.businessId,
		) ?? shops.data?.find((one) => one.role !== "COURIER");
	const settings = useQuery(
		trpc.business.settings.queryOptions(
			{ businessId: shop?.businessId ?? "" },
			{ enabled: !!shop?.businessId },
		),
	);

	if (shops.isPending || (shop && settings.isPending)) {
		return (
			<Screen title={t("biz.settings.title")} scroll bottomInset>
				<View style={styles.loading}>
					<Spinner />
				</View>
			</Screen>
		);
	}
	if (shops.error || settings.error) {
		return (
			<Screen title={t("biz.settings.title")} scroll bottomInset>
				<ErrorState
					error={shops.error ?? settings.error}
					onRetry={() => {
						void shops.refetch();
						void settings.refetch();
					}}
				/>
			</Screen>
		);
	}
	if (!shop || !settings.data) {
		return (
			<Screen title={t("biz.settings.title")} scroll bottomInset>
				<View style={styles.loading}>
					<Text>{t("state.empty")}</Text>
				</View>
			</Screen>
		);
	}

	return (
		<SettingsForm
			key={settings.data.id}
			businessId={shop.businessId}
			role={shop.role}
			settings={settings.data}
		/>
	);
}

function SettingsForm({
	businessId,
	role,
	settings,
}: {
	businessId: string;
	role: MembershipRole;
	settings: BusinessSettings;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const toast = useToast();
	const { t, intlLocale, locale } = useT();
	const canEdit = role === "OWNER" || role === "MANAGER";
	const categories = useQuery(trpc.catalog.categories.queryOptions());
	const [form, setForm] = useState<SettingsForm>(() => initialForm(settings));
	const [errors, setErrors] = useState<FieldErrors>({});
	const [categoryOpen, setCategoryOpen] = useState(false);
	const chosenCategory = (categories.data ?? []).find(
		(category) => category.id === form.categoryId,
	);
	const update = useMutation(
		trpc.business.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.show(t("biz.settings.saved"));
			},
		}),
	);
	const status = useMutation(
		trpc.business.setStatus.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries();
				toast.show(t("biz.settings.saved"));
			},
		}),
	);
	const failure = useApiFailure(update.error ?? status.error);

	function change<Key extends keyof SettingsForm>(
		key: Key,
		value: SettingsForm[Key],
	) {
		setForm((current) => ({ ...current, [key]: value }));
		setErrors((current) => ({ ...current, [key]: undefined }));
	}

	function changeHour(index: number, value: Partial<BusinessHoursEntry>) {
		setForm((current) => ({
			...current,
			hours: current.hours.map((entry, entryIndex) =>
				entryIndex === index ? { ...entry, ...value } : entry,
			),
		}));
		setErrors((current) => ({ ...current, hours: undefined }));
	}

	function save() {
		const nextErrors = validate(form, settings.currency, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		update.mutate({
			businessId,
			...asSettingsUpdate(form, settings.currency),
		});
	}

	return (
		<>
			<Screen title={t("biz.settings.title")} scroll bottomInset>
				<View style={styles.content}>
					{!canEdit ? (
						<View style={styles.notice}>
							<Text>{t("biz.settings.readOnly")}</Text>
						</View>
					) : null}
					<ScreenSection title={t("biz.settings.profile")}>
						<Card>
							<Field
								label={t("biz.settings.name")}
								value={form.name}
								onChangeText={(value) => change("name", value)}
								error={errors.name}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.description")}
								value={form.description}
								onChangeText={(value) => change("description", value)}
								multiline
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.phone")}
								value={form.phone}
								onChangeText={(value) => change("phone", value)}
								keyboardType="phone-pad"
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.email")}
								value={form.email}
								onChangeText={(value) => change("email", value)}
								error={errors.email}
								keyboardType="email-address"
								autoCapitalize="none"
								editable={canEdit}
							/>
							<ListRow
								title={t("biz.settings.category")}
								subtitle={
									chosenCategory
										? localizedName(chosenCategory, locale)
										: t("biz.new.category.placeholder")
								}
								state={chosenCategory ? t("biz.new.selected") : undefined}
								divider={false}
								chevron={canEdit}
								onPress={canEdit ? () => setCategoryOpen(true) : undefined}
							/>
							{errors.categoryId ? (
								<Text variant="caption" tone="destructive">
									{errors.categoryId}
								</Text>
							) : null}
						</Card>
					</ScreenSection>
					<ScreenSection title={t("biz.settings.address")}>
						<Card>
							<Field
								label={t("address.line1")}
								value={form.line1}
								onChangeText={(value) => change("line1", value)}
								error={errors.line1}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.line2")}
								value={form.line2}
								onChangeText={(value) => change("line2", value)}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.city")}
								value={form.city}
								onChangeText={(value) => change("city", value)}
								error={errors.city}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.region")}
								value={form.region}
								onChangeText={(value) => change("region", value)}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.country")}
								value={form.country}
								onChangeText={(value) => change("country", value)}
								error={errors.country}
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.postalCode")}
								value={form.postalCode}
								onChangeText={(value) => change("postalCode", value)}
								editable={canEdit}
							/>
						</Card>
					</ScreenSection>
					<ScreenSection title={t("biz.settings.hours")}>
						<Card>
							{DAYS_OF_WEEK.map((day, index) => {
								const entry = form.hours[index];
								if (!entry) return null;
								const dayLabel =
									weekdayName(day, intlLocale ?? "es") ?? String(day);
								return (
									<View key={day} style={styles.hourRow}>
										<Text variant="label" bold>
											{dayLabel}
										</Text>
										<Segmented
											label={dayLabel}
											value={entry.isClosed ? "closed" : "open"}
											onChange={(value) =>
												changeHour(index, { isClosed: value === "closed" })
											}
											options={[
												{
													value: "open",
													label: t("biz.locations.status.open"),
												},
												{
													value: "closed",
													label: t("biz.settings.hours.closed"),
												},
											]}
											disabled={!canEdit}
										/>
										{entry.isClosed ? null : (
											<View style={styles.hourFields}>
												<View style={styles.hourField}>
													<Field
														label={t("biz.settings.hours.opens")}
														value={minuteInput(entry.opensMinute)}
														onChangeText={(value) => {
															const minute = minuteValue(value);
															changeHour(index, {
																opensMinute: minute ?? entry.opensMinute,
															});
														}}
														keyboardType="numbers-and-punctuation"
														editable={canEdit}
													/>
												</View>
												<View style={styles.hourField}>
													<Field
														label={t("biz.settings.hours.closes")}
														value={minuteInput(entry.closesMinute)}
														onChangeText={(value) => {
															const minute = minuteValue(value);
															changeHour(index, {
																closesMinute: minute ?? entry.closesMinute,
															});
														}}
														keyboardType="numbers-and-punctuation"
														editable={canEdit}
													/>
												</View>
											</View>
										)}
									</View>
								);
							})}
							{errors.hours ? (
								<Text variant="caption">{errors.hours}</Text>
							) : null}
						</Card>
					</ScreenSection>
					<ScreenSection title={t("biz.settings.delivery")}>
						<Card>
							<Text variant="label" bold>
								{t("biz.settings.pickup.enabled")}
							</Text>
							<Segmented
								label={t("biz.settings.pickup.enabled")}
								value={form.pickupEnabled ? "on" : "off"}
								onChange={(value) => change("pickupEnabled", value === "on")}
								options={[
									{ value: "on", label: t("biz.locations.status.open") },
									{ value: "off", label: t("biz.settings.hours.closed") },
								]}
								disabled={!canEdit}
							/>
							<Text variant="label" bold>
								{t("biz.settings.delivery.enabled")}
							</Text>
							<Segmented
								label={t("biz.settings.delivery.enabled")}
								value={form.deliveryEnabled ? "on" : "off"}
								onChange={(value) => change("deliveryEnabled", value === "on")}
								options={[
									{ value: "on", label: t("biz.locations.status.open") },
									{ value: "off", label: t("biz.settings.hours.closed") },
								]}
								disabled={!canEdit}
							/>
							<Field
								label={t("biz.settings.delivery.fee")}
								value={form.deliveryFeeMinor}
								onChangeText={(value) => change("deliveryFeeMinor", value)}
								error={errors.deliveryFeeMinor}
								help={t("biz.settings.delivery.fee.help")}
								keyboardType="decimal-pad"
								editable={canEdit}
							/>
							{form.deliveryEnabled ? (
								<>
									<Text variant="label" bold>
										{t("biz.settings.delivery.cover")}
									</Text>
									<Segmented
										label={t("biz.settings.delivery.cover")}
										value={form.merchantCoversDelivery ? "on" : "off"}
										onChange={(value) =>
											change("merchantCoversDelivery", value === "on")
										}
										options={[
											{
												value: "off",
												label: t("biz.settings.delivery.cover.off"),
											},
											{
												value: "on",
												label: t("biz.settings.delivery.cover.on"),
											},
										]}
										disabled={!canEdit}
									/>
									<Text variant="caption" tone="muted">
										{t("biz.settings.delivery.cover.help")}
									</Text>
								</>
							) : null}
							<Field
								label={t("biz.settings.delivery.radius")}
								value={form.deliveryRadiusKm}
								onChangeText={(value) => change("deliveryRadiusKm", value)}
								error={errors.deliveryRadiusKm}
								keyboardType="decimal-pad"
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.delivery.minOrder")}
								value={form.minOrderMinor}
								onChangeText={(value) => change("minOrderMinor", value)}
								error={errors.minOrderMinor}
								keyboardType="decimal-pad"
								editable={canEdit}
							/>
							<Field
								label={t("biz.settings.delivery.prepTime")}
								value={form.prepTimeMinutes}
								onChangeText={(value) => change("prepTimeMinutes", value)}
								error={errors.prepTimeMinutes}
								keyboardType="number-pad"
								editable={canEdit}
							/>
						</Card>
					</ScreenSection>
					<ScreenSection title={t("biz.manage.brandAssets")}>
						<Card>
							{/* The two pictures, composed the way a storefront card draws them.

							    They used to be `<Field>`s bound to `logoUrl`/`coverUrl`,
							    which asked a merchant to paste an internal `/files/:id`
							    path by hand — the only control on this form with no way
							    to be right, and the one whose wrong answer is a broken
							    image on the Orders board header, the Home header and
							    every storefront card at once.

							    **Portada on top, logo on the left, straddling its edge.**
							    Not two stacked boxes because these are not two
							    independent facts: `components/business-card` draws
							    them as *one* card, and a merchant choosing a banner and
							    a mark for that card is composing a thing, not filling in
							    two fields. `styles.brand` pulls the logo up by half its
							    own height so the circle sits on the portada's bottom
							    edge rather than under it, which is the arrangement every
							    shop front uses and the one that shows at a glance
							    whether the mark will still read on top of the
							    photograph.

							    The logo keeps `radiusToken="full"` because `business.tsx`
							    draws the shop's logo as a circle and a square preview is
							    a picture of a different thing; the cover takes
							    `styles.coverPreview`, the 16:9 band `business-card`
							    draws. Both are `./photo-picker`'s rule that a preview
							    takes the shape of the thing it stands for.

							    Each picker draws its own sheet, so the composition is
							    made of two ordinary controls and neither had to learn
							    about the other.

							    **No buttons, and no repeated labels.** `layout="tap"`
							    makes the picture itself the control: press the portada
							    band to change the portada, press the circle to change
							    the logo, and the two acts arrive in a sheet from
							    whichever one was pressed. The first version of this
							    block gave each half its own stacked "Subir foto" and
							    "Tomar foto" pair and printed each label twice — four
							    buttons and two duplicated headings under two
							    pictures, which made the buttons the loudest thing in
							    a block whose entire job is to show a photograph.
							    `components/business-card` draws this as one object
							    with no chrome, and the editor now matches it.

							    **Only the logo carries the help line.** The logo
							    hangs half its height over whatever sits directly
							    beneath the portada, and directly beneath the
							    portada is *its* reserved message row — so a help
							    line there is a line of words under a circle.
							    `./photo-picker` reserves that row whether or not it
							    has anything in it precisely so nothing reflows,
							    which is what makes the empty row the right place
							    for the circle to land. One sentence for the pair, at
							    the bottom of the pair. */}
							<View style={styles.brand}>
								<Text variant="label" bold>
									{t("biz.settings.cover")}
								</Text>
								<PhotoPicker
									label={t("biz.settings.cover")}
									value={form.coverUrl}
									onChange={(next) => change("coverUrl", next)}
									previewStyle={styles.coverPreview}
									aspect={[16, 9]}
									layout="tap"
									businessId={businessId}
									purpose="business-logo"
									disabled={!canEdit}
								/>
								{/* The half that hangs below the portada is why `brand`
								    reserves `paddingBottom`: without it the circle is
								    clipped by the card's own bounds and the merchant
								    sees a semicircle. It lands on the portada's reserved
								    (empty) message row, which is the one band of this
								    block with nothing in it — see the note above for
								    why the portada carries no help of its own. */}
								<View style={styles.brandLogo}>
									<PhotoPicker
										label={t("biz.settings.logo")}
										value={form.logoUrl}
										onChange={(next) => change("logoUrl", next)}
										radiusToken="full"
										aspect={[1, 1]}
										layout="tap"
										previewStyle={styles.brandLogoPreview}
										businessId={businessId}
										purpose="business-logo"
										disabled={!canEdit}
									>
										{/* The shop's own initial, so a merchant who has not
										    picked a mark yet sees the mark their customers
										    already see — `business-card`'s fallback, not a
										    blank circle. `./photo-picker` lets `children`
										    stand in for its empty-state glyph for exactly
										    this case: an initial with an image-placeholder
										    printed over it would be neither. */}
										<Text variant="title" bold tone="action">
											{settings.name.trim().charAt(0).toUpperCase()}
										</Text>
									</PhotoPicker>
									<Text variant="label" bold style={styles.brandLogoLabel}>
										{t("biz.settings.logo")}
									</Text>
									{/* The pair's one help line, here rather than on either
									    picker. `./photo-picker` prints `help` inside its
									    own wrapper directly under the picture, which put
									    the sentence between the circle and the word
									    "Logo" that names it. One sentence, after the
									    name, about both pictures. */}
									<View style={styles.brandHelp}>
										<Text variant="caption" tone="muted">
											{t("biz.settings.photo.help")}
										</Text>
									</View>
								</View>
							</View>
							<View style={styles.currency}>
								<Text variant="label" bold>
									{t("biz.settings.currency")}
								</Text>
								<Text>{settings.currency}</Text>
							</View>
						</Card>
					</ScreenSection>
					{role === "OWNER" ? (
						<ScreenSection title={t("biz.settings.pause")}>
							<Card>
								<Text>{t(`biz.status.${settings.status}`)}</Text>
								<Button
									label={
										settings.status === "ACTIVE"
											? t("biz.settings.pause")
											: t("biz.settings.publish")
									}
									onPress={() =>
										status.mutate({
											businessId,
											status:
												settings.status === "ACTIVE" ? "CLOSED" : "ACTIVE",
										})
									}
									loading={status.isPending}
									variant="secondary"
								/>
							</Card>
						</ScreenSection>
					) : null}
					{(update.error || status.error) && failure.message ? (
						<View style={styles.failure}>
							<Text variant="caption">{failure.message}</Text>
						</View>
					) : null}
					<ActionBar
						primary={{
							label: t("biz.settings.save"),
							onPress: save,
							loading: update.isPending,
						}}
						accessibilityLabel={t("biz.settings.save")}
					/>
				</View>
			</Screen>
			<CategoryPickerSheet
				open={categoryOpen}
				onClose={() => setCategoryOpen(false)}
				categories={categories.data ?? []}
				selectedId={form.categoryId}
				locale={locale}
				onSelect={(categoryId) => {
					change("categoryId", categoryId);
					setCategoryOpen(false);
				}}
			/>
		</>
	);
}

function CategoryPickerSheet({
	open,
	onClose,
	categories,
	selectedId,
	locale,
	onSelect,
}: {
	open: boolean;
	onClose: () => void;
	categories: Category[];
	selectedId: string | null;
	locale: ReturnType<typeof useT>["locale"];
	onSelect: (categoryId: string) => void;
}) {
	const { t } = useT();
	const [expandedSectorId, setExpandedSectorId] = useState<
		string | undefined
	>();
	const selected = categories.find((category) => category.id === selectedId);
	const sectorId = expandedSectorId ?? selected?.parentId ?? undefined;
	const rows = categories
		.filter((category) => category.parentId === null)
		.flatMap((sector) =>
			sector.id === sectorId
				? [
						sector,
						...categories.filter((category) => category.parentId === sector.id),
					]
				: [sector],
		);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={t("biz.settings.category")}
			closeLabel={t("action.close")}
		>
			{rows.length ? (
				<Card>
					{rows.map((category, index) => {
						const hasChildren = categories.some(
							(one) => one.parentId === category.id,
						);
						const isSelected = category.id === selectedId;
						return (
							<ListRow
								key={category.id}
								title={localizedName(category, locale)}
								leading={
									category.parentId === null ? undefined : (
										<View style={styles.categoryIndent} />
									)
								}
								state={isSelected ? t("biz.new.selected") : undefined}
								divider={index < rows.length - 1}
								chevron={hasChildren}
								accessibilityHint={
									hasChildren ? t("biz.new.category.open") : undefined
								}
								onPress={() => {
									if (hasChildren) {
										setExpandedSectorId(category.id);
										return;
									}
									if (!isSelected) selection();
									onSelect(category.id);
								}}
							/>
						);
					})}
				</Card>
			) : (
				<ManagementEmpty
					title={t("biz.new.category.placeholder")}
					body={t("biz.new.category.help")}
				/>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	content: { gap: space.xl, paddingBottom: space.huge },
	loading: { flex: 1, alignItems: "center", justifyContent: "center" },
	notice: {
		borderRadius: radius.md,
		padding: space.md,
	},
	hourRow: { gap: space.sm, paddingVertical: space.sm },
	hourFields: { flexDirection: "row", gap: space.md },
	hourField: { flex: 1 },
	categoryIndent: { width: space.md },
	/**
	 * The cover's box, and the same split `components/business-card` gives its band:
	 * 16:9 across the full width. `./photo-picker`'s own default is a square
	 * `media.row` thumbnail because that is what a product photo is, and reusing it
	 * here would preview a wide photograph as a square crop — the merchant would be
	 * cropping against a box that lies about where the picture lands.
	 */
	coverPreview: { width: "100%", aspectRatio: 16 / 9 },
	/**
	 * The composed brand block: portada band on top, logo circle on its bottom-left
	 * edge.
	 *
	 * `paddingBottom` reserves the half of the logo that hangs below the portada. No
	 * `overflow: "hidden"` anywhere in this subtree, and deliberately: a clip here
	 * would cut the logo's bottom half off and the merchant would see a semicircle.
	 * The portada's own corners come from `./photo-picker`'s `Image`, which rounds
	 * the image itself.
	 */
	brand: { paddingBottom: BRAND_LOGO / 2 },
	/**
	 * The logo's slot, pulled up by half its own height so the circle straddles the
	 * portada's bottom edge — the arrangement `components/business-card` draws and
	 * the one a merchant recognises as "how my shop will look".
	 *
	 * `alignSelf: "flex-start"` rather than a width, so the slot is exactly as wide
	 * as the preview inside it and the two pickers' control bars keep their own
	 * measure rather than both being stretched to the card's.
	 */
	brandLogo: { marginTop: -(BRAND_LOGO / 2), alignSelf: "flex-start" },
	/**
	 * The circle's box. `width` rather than letting `./photo-picker`'s own
	 * `media.row` decide, because this is the one measurement in the block read
	 * from three places — here, `brand`'s padding, and `brandLogo`'s margin — and
	 * three copies of `media.row` would be three numbers to keep in agreement.
	 */
	brandLogoPreview: { width: BRAND_LOGO, aspectRatio: 1 },
	/**
	 * The logo's caption, pulled up over `./photo-picker`'s reserved message row.
	 *
	 * `"tap"` draws no label under the picture — the picture is the control and its
	 * name is in the sheet it opens — so the block supplies its own two captions:
	 * one above the portada, one below the logo. Below rather than above because
	 * above the logo is *over the portada*, and a caption lying on the photograph is
	 * one the merchant cannot read.
	 *
	 * The negative margin is exactly `type.caption.lineHeight`: that is the height
	 * of the empty row `./photo-picker` reserves below its picture so a refusal never
	 * reflows the form, and this caption takes its place rather than sitting a whole
	 * row below an invisible one. Written as the token rather than a number because
	 * the row it cancels is that token.
	 */
	brandLogoLabel: { marginTop: -type.caption.lineHeight },
	/**
	 * The pair's help line's slot.
	 *
	 * `space.xs` from the caption above rather than from the picture, because the
	 * two are one sentence pair — "Logo" then why a picture is wanted — and the
	 * reserved message row they share is already spoken for by `brandLogoLabel`.
	 */
	brandHelp: { marginTop: space.xs },
	currency: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	failure: { paddingHorizontal: space.md },
});

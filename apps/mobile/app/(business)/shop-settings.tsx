import { localizedName } from "@pymeshub/i18n";
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
import { Screen, ScreenSection } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { line } from "@/components/skeletons";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { categoryPickerRows, indentFor } from "@/lib/category-scope";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useMerchantScope } from "@/lib/merchant-scope";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space } from "@/theme";

/** Business details, contact and pickup address. Photos are edited in Personalization. */
export default function ShopSettings() {
	const { t, locale } = useT();
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
	const [email, setEmail] = useState("");
	const [line1, setLine1] = useState("");
	const [line2, setLine2] = useState("");
	const [city, setCity] = useState("");
	const [region, setRegion] = useState("");
	const [postalCode, setPostalCode] = useState("");
	const [editingAddress, setEditingAddress] = useState(false);
	const [categoryOpen, setCategoryOpen] = useState(false);
	const [openSectorId, setOpenSectorId] = useState<string | undefined>(
		undefined,
	);
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const prefilled = useRef(false);

	const update = useMutation(trpc.business.update.mutationOptions());
	const failure = useApiFailure(update.error);

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
		if (prefilled.current || !settings.data) return;
		prefilled.current = true;
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
	}, [settings.data]);

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
				"name" | "categoryId" | "phone" | "email" | "line1" | "city" | "region",
				string
			>
		> = {};
		if (!name.trim()) found.name = t("form.required");
		if (!categoryId) found.categoryId = t("form.required");
		if (editingAddress && !line1.trim()) found.line1 = t("form.required");
		if (editingAddress && !city.trim()) found.city = t("form.required");
		if (editingAddress && !region.trim()) found.region = t("form.required");
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
		return found;
	}, [name, categoryId, line1, city, region, editingAddress, phone, email, t]);

	const submit = () => {
		if (update.isPending) return;
		setSubmitted(true);
		if (Object.keys(problems).length > 0) return;
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
				email: email.trim() || null,
				...(editingAddress
					? {
							line1: line1.trim(),
							line2: line2.trim(),
							city: city.trim(),
							region: region.trim(),
							postalCode: postalCode.trim(),
						}
					: {}),
			},
			{
				onSuccess: async () => {
					setSaving(false);
					toast.show(t("biz.settings.saved"));
					await cache.invalidateQueries({
						queryKey: trpc.business.pathKey(),
					});
				},
				onError: () => setSaving(false),
			},
		);
	};

	const edited = (apply: () => void) => {
		apply();
		if (update.isError) update.reset();
	};

	const failed = shops.error ?? settings.error;
	const ready = businessId.length > 0 && !!settings.data && !waiting;

	return (
		<View style={styles.root}>
			<Screen
				title={t("biz.settings.title")}
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
							<AnimateIn index={0}>
								<ScreenSection title={t("biz.settings.profile")}>
									<Field
										label={t("biz.settings.name")}
										value={name}
										onChangeText={(value) => edited(() => setName(value))}
										error={submitted ? (problems.name ?? null) : null}
										// The one field a customer reads on every card and every
										// header, so the ceiling is stated rather than left to
										// the round trip: `shortText(120)` is what the API trims
										// and refuses, restated here so the box catches it.
										help={t("form.tooLong", { max: 120 })}
										maxLength={120}
									/>

									<Field
										label={t("biz.settings.description")}
										value={description}
										onChangeText={(value) =>
											edited(() => setDescription(value))
										}
										help={t("form.tooLong", { max: 600 })}
										multiline
										maxLength={600}
									/>
								</ScreenSection>
							</AnimateIn>

							{/* The vertical the shop sells in. Its own section rather than a
							    row inside the one above: it is a choice about where the shop
							    appears in the marketplace, not a fact about its face. */}
							<AnimateIn index={1}>
								<ScreenSection title={t("biz.settings.category")}>
									<Text variant="caption" tone="muted">
										{t("biz.new.category.help")}
									</Text>
									<Card>
										<ListRow
											title={
												chosen
													? localizedName(chosen, locale)
													: // The id can be set while `catalog.categories` is still in
														// flight; saying "pick one" then would be a lie about a
														// value the row already holds.
														categoryId
														? t("state.loading")
														: t("biz.new.category.placeholder")
											}
											state={chosen ? t("biz.new.selected") : undefined}
											chevron
											divider={false}
											accessibilityHint={t("biz.new.category.open")}
											onPress={() => setCategoryOpen(true)}
										/>
									</Card>
									{submitted && problems.categoryId ? (
										<Text
											variant="body"
											tone="destructive"
											accessibilityRole="alert"
										>
											{problems.categoryId}
										</Text>
									) : null}
								</ScreenSection>
							</AnimateIn>

							{/* The two details a customer uses to reach a person rather than
							    a screen. They share a section because they answer the same
							    question, and because neither is part of the address a courier
							    drives to. */}
							<AnimateIn index={2}>
								<ScreenSection title={t("biz.settings.contact")}>
									<Field
										label={t("biz.settings.phone")}
										value={phone}
										onChangeText={(value) => edited(() => setPhone(value))}
										error={submitted ? (problems.phone ?? null) : null}
										help={t("form.optional")}
										keyboardType="phone-pad"
										autoComplete="tel"
										maxLength={24}
									/>
									<Field
										label={t("biz.settings.email")}
										value={email}
										onChangeText={(value) => edited(() => setEmail(value))}
										error={submitted ? (problems.email ?? null) : null}
										help={t("form.optional")}
										keyboardType="email-address"
										autoComplete="email"
										autoCapitalize="none"
										maxLength={200}
									/>
								</ScreenSection>
							</AnimateIn>

							{/* The shop's own address, which `biz.settings.address.help`
							    states the two uses of: where a customer comes to pick an
							    order up, and the centre the delivery radius is measured from.
							    Three of the five are the create path's required set, so they
							    refuse an emptied box rather than clearing it. */}
							<AnimateIn index={3}>
								<ScreenSection title={t("biz.settings.address")}>
									<Text variant="caption" tone="muted">
										{t("biz.settings.address.help")}
									</Text>
									<Button
										label={t("biz.order.dispatch.setPickupPin")}
										variant="secondary"
										fullWidth
										onPress={() => router.push("/(business)/shop-location")}
									/>
									{settings.data ? (
										<Text variant="body" tone="muted">
											{[
												settings.data.line1,
												settings.data.line2,
												settings.data.city,
												settings.data.region,
											]
												.filter(Boolean)
												.join(", ")}
										</Text>
									) : null}
									<Button
										label={t("biz.settings.address.editManually")}
										variant="ghost"
										fullWidth
										onPress={() => {
											if (!editingAddress && settings.data) {
												setLine1(settings.data.line1);
												setLine2(settings.data.line2 ?? "");
												setCity(settings.data.city);
												setRegion(settings.data.region);
												setPostalCode(settings.data.postalCode ?? "");
											}
											setEditingAddress(!editingAddress);
										}}
									/>
									{editingAddress ? (
										<>
											<Field
												label={t("biz.settings.line1")}
												value={line1}
												onChangeText={(value) => edited(() => setLine1(value))}
												error={submitted ? (problems.line1 ?? null) : null}
												maxLength={200}
											/>
											<Field
												label={t("biz.settings.line2")}
												value={line2}
												onChangeText={(value) => edited(() => setLine2(value))}
												help={t("form.optional")}
												maxLength={200}
											/>
											<Field
												label={t("biz.settings.city")}
												value={city}
												onChangeText={(value) => edited(() => setCity(value))}
												error={submitted ? (problems.city ?? null) : null}
												maxLength={80}
											/>
											<Field
												label={t("biz.settings.region")}
												value={region}
												onChangeText={(value) => edited(() => setRegion(value))}
												error={submitted ? (problems.region ?? null) : null}
												maxLength={80}
											/>
											<Field
												label={t("biz.settings.postalCode")}
												value={postalCode}
												onChangeText={(value) =>
													edited(() => setPostalCode(value))
												}
												help={t("form.optional")}
												maxLength={16}
											/>
										</>
									) : null}
								</ScreenSection>
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

			{ready ? (
				<ActionBar
					docked
					primary={{
						label: t("biz.settings.save"),
						onPress: submit,
						loading: saving,
						disabled: saving,
					}}
				/>
			) : null}
		</View>
	);
}

/**
 * The form in grey, in the shape it will have: each field's triple — label, box,
 * reserved message row — under its own real `ScreenSection` title, and the
 * category's help line and the one row the list toggles open.
 * The order is the real form's, so the skeleton and the form it stands in for
 * are the same page. The heights are the real form's at the reader's text scale,
 * which is why every line goes through `line()` rather than through a fixed
 * number, and the page does not jump when the values land.
 *
 * The section headings are the screen's own copy — facts a read does not carry —
 * so the sections are drawn real and only the values are grey. The category's
 * help line and the address's help line are grey for the same reason the field
 * labels are not: their words carry what the shop is and where it sits, which is
 * exactly what a read that is still in flight has not answered yet.
 */
function ShopSettingsSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { t } = useT();
	const { fontScale } = useWindowDimensions();

	// One `./list-row`: the category row's `space.md` of vertical padding twice
	// around its title's `body` line, over the row's own touch floor — the box the
	// closed row pays.
	const categoryRow = Math.max(
		MIN_TOUCH_TARGET,
		space.md * 2 + line("body", fontScale).height,
	);

	return (
		<View style={styles.content}>
			<ScreenSection title={t("biz.settings.profile")}>
				<View style={formStyles.field}>
					<Skeleton
						label={loadingLabel}
						style={[formStyles.label, line("label", fontScale)]}
					/>
					<Skeleton style={formStyles.input} />
					<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				</View>

				{/* The description's box is `multiline` and blank it sits at the same
				    floor — the box grows with what is typed into it, not with being
				    empty, which is the sum the note field's block draws in `./skeletons`
				    for the same multiline `./field`. */}
				<View style={formStyles.field}>
					<Skeleton style={[formStyles.label, line("label", fontScale)]} />
					<Skeleton style={formStyles.input} />
					<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				</View>
			</ScreenSection>

			<ScreenSection title={t("biz.settings.category")}>
				<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				<Card>
					<Skeleton style={{ height: categoryRow }} />
				</Card>
			</ScreenSection>

			<ScreenSection title={t("biz.settings.contact")}>
				{[0, 1].map((index) => (
					<View key={index} style={formStyles.field}>
						<Skeleton style={[formStyles.label, line("label", fontScale)]} />
						<Skeleton style={formStyles.input} />
						<Skeleton
							style={[formStyles.message, line("caption", fontScale)]}
						/>
					</View>
				))}
			</ScreenSection>

			<ScreenSection title={t("biz.settings.address")}>
				<Skeleton style={[formStyles.message, line("caption", fontScale)]} />
				<Skeleton style={formStyles.input} />
				<Skeleton style={[formStyles.message, line("body", fontScale)]} />
			</ScreenSection>
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
	content: { gap: space.lg },
	// One step of the scale, applied only to a row whose parent is also on the
	// list (`indentFor`). Unscoped here, the sector is present and its children
	// step in under it. This is air, never a second row shape.
	indent: { width: space.lg },
});

/**
 * The grey field's own rows: `./field`'s `wrap` gap between the label, the box and
 * the message row (`components/field.tsx`'s `wrap`), the box at the floor the real
 * input pays (`components/field.tsx`'s `input`), and a line each for the label and
 * the message — the label's width is a stand-in for a word the read does not carry,
 * and the message row is reserved, so it is a line rather than an empty box.
 */
const formStyles = StyleSheet.create({
	field: { gap: space.sm },
	label: { width: "35%" },
	input: { minHeight: MIN_TOUCH_TARGET },
	message: { width: "60%" },
});

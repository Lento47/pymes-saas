import Ionicons from "@expo/vector-icons/Ionicons";
import type { Address } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimateIn } from "@/components/animate-in";
import { Button } from "@/components/button";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Pressable } from "@/components/pressable";
import { useRefreshControl } from "@/components/pull-refresh";
import { RollbackNotice } from "@/components/rollback-notice";
import { Screen } from "@/components/screen";
import { Sheet } from "@/components/sheet";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { selection, warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import {
	icon,
	MIN_TOUCH_TARGET,
	media,
	space,
	TEXT_STACK_GAP,
	type,
	useTheme,
} from "@/theme";

/**
 * Where a customer's delivery addresses live.
 *
 * A list this short does not need a pushed route of its own per job: it is a list of addresses
 * and a form, and the form is a panel over the list rather than a route after it, because "add
 * an address" is very often done *while* looking at the list you are adding to — and the list
 * is the thing that tells the customer which address is missing.
 *
 * ## Rows, not cards
 *
 * Each address used to be a `Card` holding a title, a street and two ghost buttons — a surface
 * with three stacked lines and a pair of controls that read as the card's content. An address
 * is not a card: it is a line in a list, and it is drawn as one — a picture slot, a name, the
 * street under it, the state said in words, and the two things you can do to it at the end of
 * the line. `./list-row` is that row, and this screen no longer builds its own.
 *
 * ## The order the eye reads, and the order the tree reads
 *
 * Tapping the row opens the edit form, and the chevron says so. Deleting is a separate control
 * and it is a **sibling** of the row rather than a button inside it: a pressable that carries an
 * `accessibilityLabel` is one element to a screen reader, so a control nested in it is a control
 * a reader cannot reach. Beside it, the tree is row first and delete second — the same two
 * things, in the same order, as the line the eye is looking at. The trash glyph is decoration
 * and the word lives on the control (`action.delete`, with the address's own name as its hint),
 * which is also why the row's own label is the whole sentence rather than the label alone.
 *
 * ## Deleting is a commit, and it looks like one
 *
 * Removing an address is the one destructive act here, so it is confirmed, and the confirm
 * carries `warning()` — fired on the button that does the thing, not on the tap that opened the
 * dialog. The dialog names the address in its body so the reader confirms the one they meant,
 * and neither button is worded to make declining feel like a mistake. A refusal after the fact
 * is a `RollbackNotice`, which prints the API's own sentence: an address attached to an order in
 * flight is refused with a reason, and that reason is the only part of this screen a customer can
 * act on.
 *
 * ## Both the write and the delete can be refused
 *
 * Neither mutation is optimistic. An address is not a quantity the customer can see change
 * under their thumb — it is a record the API validates (a region it knows, a phone it can
 * parse), and a form that closed optimistically would have to reopen itself. The button
 * goes busy, the answer comes back, and the failure keeps the form on screen with its
 * fields still filled — including when the form is a sheet, which is why the sheet is not
 * closed by a failure.
 *
 * ## The form is a sheet, and the sheet is why this screen has its own scroll
 *
 * The form used to be a block appended under the list, which meant that on a phone with four
 * addresses and the keyboard up, the field being typed into and the list behind it were two
 * halves of one long scroll. It is a sheet now — the panel this app already has for "choose
 * something without leaving the screen you are on" — and the list stays visible behind it.
 *
 * `./sheet` is not portalled: `StyleSheet.absoluteFill` resolves against its nearest parent,
 * so a sheet mounted inside `Screen`'s `ScrollView` is laid out *in* the scrolled content and
 * leaves the screen with it. So this screen keeps `scroll` off and renders the `ScrollView`
 * itself, with the sheet as its sibling and last child — the arrangement `app/cart` uses for
 * the promo sheet, and the reason `./promo-input` and `./promo-sheet` are two components.
 */
export default function Addresses() {
	const { t } = useT();
	return (
		// `contentStyle` strips the body's gutter rather than adding to it: the scroll and the
		// sheet each pay their own `space.lg`, and the sheet has to reach both of the screen's
		// edges to be a sheet. The title strip is drawn by `Screen` and keeps its own padding,
		// so nothing in the header moves.
		<Screen title={t("account.addresses.title")} contentStyle={styles.frame}>
			<SignedIn>
				<AddressBook />
			</SignedIn>
		</Screen>
	);
}

function AddressBook() {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const [editing, setEditing] = useState<Address | null>(null);
	const [show, setShow] = useState(false);
	// The address the question is about, or `null` while none is being asked about: the panel's
	// body is that address's first line, so the state has to hold the row and not just a boolean.
	const [removing, setRemoving] = useState<Address | null>(null);
	const query = useQuery(trpc.users.addresses.queryOptions());
	const remove = useMutation(
		trpc.users.deleteAddress.mutationOptions({
			onSuccess: async () => {
				// Scoped to the procedure's own key root: a deleted address moves `users.*` and
				// nothing else. Keyless this refetched every mounted query in the client.
				await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
			},
		}),
	);
	const waiting = useSkeletonHold(query.isPending);
	/**
	 * The pull, on this screen's own read. The control — both tints, a flag that belongs to the
	 * gesture rather than to the query, and `undefined` rather than a control that never
	 * refreshes — is `./pull-refresh`'s, which is where the three rules are written down. What
	 * is this screen's is why it has one at all: the list can change under the customer — the
	 * same address is editable from another device, and this screen's own form saves into it.
	 */
	const refreshControl = useRefreshControl(query.refetch);
	// Read once, so the branches below narrow on the data itself: the minimum hold keeps the
	// skeletons up for a moment after the answer lands, and `isPending` alone would be false
	// while `data` was still undefined in that window.
	const list = query.data;

	function openForm(address: Address | null) {
		setEditing(address);
		setShow(true);
	}

	/**
	 * The row asks through `./confirm-sheet` and names itself in the panel's body, because
	 * "Eliminar dirección" as a bare question does not say which one — a customer with two
	 * addresses answers a question about neither.
	 */
	function confirmRemove() {
		if (!removing) return;
		warning();
		remove.mutate({ id: removing.id });
	}

	return (
		<>
			<ScrollView
				contentContainerStyle={[
					styles.scroll,
					// The floor's clearance, which `Screen`'s `bottomInset` used to pay. It is paid
					// here because this screen no longer asks for that edge: the sheet covers the
					// bottom of the screen when it is open, and a `SafeAreaView` inset would have
					// held the panel's own edge above the home indicator with a strip of
					// background under it. The scroll is what reaches the floor.
					{ paddingBottom: insets.bottom + space.lg },
				]}
				keyboardShouldPersistTaps="handled"
				// The pair `./screen` puts on the scroller it owns, carried here because this
				// screen keeps `scroll` off and brings its own — the same reason it pays its own
				// bottom inset above. See `docs/design-mobile.md`, "A platform difference is a
				// contract in two places, not a `Platform.OS` in a screen".
				keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
				// `true` and not a prop, for the reason `app/checkout` gives: `Screen`'s
				// `keyboardInsets` reaches only the scroller `Screen` owns, so with `scroll` off
				// there is no value in scope to pass — the prop on `Screen` would be read by
				// nobody. `true` is what `screen.tsx:177-179` sends for a screen that opted in.
				// `undefined` rather than `false` off iOS: React drops an undefined prop, so
				// Android is never handed a key it does not implement.
				//
				// The fields this screen writes are in the `Sheet` below rather than in this
				// scroller, so on the code the inset is the sheet's `avoidKeyboard` that
				// serves them (the `KeyboardAvoidingView` at `sheet.tsx:547-551`) and this is
				// the geometry-derived complement to it, not the primary path. It stays because
				// the form's home has moved once already — the docblock above records it as a
				// block appended under this very list — and because a scroller that owns the
				// fields again would otherwise be the tenth screen with no inset.
				automaticallyAdjustKeyboardInsets={
					Platform.OS === "ios" ? true : undefined
				}
				// Passed here for the same reason the pair above is: this screen owns its
				// scroller, so `Screen`'s `onRefresh` — which reaches only the scroll `Screen`
				// builds — would be read by nobody. `./pull-refresh` holds the control itself,
				// both tints and the flag, and the docblock above holds why this list has a pull.
				refreshControl={refreshControl}
			>
				{query.isError ? (
					<ErrorState
						error={query.error}
						onRetry={() => void query.refetch()}
					/>
				) : waiting || !list ? (
					<AddressSkeleton label={t("state.loading")} />
				) : !list.length ? (
					<EmptyState
						icon="location-outline"
						title={t("account.addresses.empty")}
						actionLabel={t("account.addresses.add")}
						onAction={() => openForm(null)}
					/>
				) : (
					<View>
						{list.map((address, index) => (
							// `reorder` because the delete button beside each of these rows is aimed at
							// this list: the customer removes an address and the rows under it are the
							// same rows closing the gap, not a new set arriving. The key is the
							// address's own id, so an address that is genuinely new still mounts its own
							// `AnimateIn` and still enters.
							<AnimateIn key={address.id} index={index} reorder>
								<View
									style={[
										styles.entry,
										{ borderBottomColor: colors.border },
										// The last entry closes the list rather than starting another
										// one, so it does not draw a rule with nothing under it.
										index === list.length - 1 && styles.entryLast,
									]}
								>
									<ListRow
										title={address.label}
										subtitle={`${address.line1}, ${address.city}`}
										thumbnail={
											<Ionicons
												name="location-outline"
												size={icon.action}
												color={colors.mutedForeground}
											/>
										}
										// A word, not a tint: "Predeterminada" is what tells a reader
										// which address the checkout will offer first, and it survives
										// a greyscale screenshot and a colour vision deficiency.
										state={
											address.isDefault
												? t("account.addresses.default")
												: undefined
										}
										chevron
										// The line under the pair belongs to the pair, so it is drawn
										// once by the container rather than stopping short of the
										// delete button at the row's own edge.
										divider={false}
										onPress={() => openForm(address)}
										accessibilityHint={t("account.addresses.row.help")}
										style={styles.entryRow}
									/>
									<Pressable
										onPress={() => setRemoving(address)}
										// This row's delete, not the list's. `remove.isPending` alone dims
										// every row's control while one of them is being deleted — three
										// addresses, one write, three controls at `./pressable`'s
										// `disabledOpacity` — which tells the customer that addresses they
										// did not touch are busy. `variables` is the id the in-flight call
										// was made with, so the scoping is the same shape
										// `app/business.tsx:431-432` gives its own per-row moves.
										disabled={
											remove.isPending && remove.variables?.id === address.id
										}
										accessibilityRole="button"
										accessibilityLabel={t("action.delete")}
										// The address's own name is the hint, the way `./product-row`
										// gives its add target the product's: "Eliminar" alone is a row
										// of identical controls, and a reader has to know which one.
										accessibilityHint={address.label}
										style={styles.entryAction}
									>
										<Ionicons
											name="trash-outline"
											size={icon.control}
											color={colors.destructive}
											// Decoration: the pressable around it carries the word.
											accessibilityElementsHidden
											importantForAccessibility="no"
										/>
									</Pressable>
								</View>
							</AnimateIn>
						))}
					</View>
				)}

				{/* The API's own sentence, under the list it is about. Nothing here retries: the
			    customer re-taps the button that failed, because the fix is a choice they make. */}
				<RollbackNotice error={remove.error} />

				{list?.length ? (
					<Button
						label={t("account.addresses.add")}
						onPress={() => openForm(null)}
					/>
				) : null}
			</ScrollView>

			{/* The form, in the panel this app already uses for "choose something without
			    leaving the screen you are on".

			    The sheet is mounted whether or not it is open, and that is load-bearing rather
			    than an oversight: `./sheet` keeps its own `mounted` state so the exit can play
			    before the panel leaves the tree, and a parent that mounted it on `show` would
			    unmount it in the frame the customer tapped Cancel — no exit at all, which is the
			    exact defect that file's docblock names. Closed, it renders nothing, so the form
			    inside it is not mounted either and its draft is fresh on every open.

			    A failure does not close it: `save.error` is drawn inside the form's own scroll,
			    with the fields still filled, because the reason the API refused is a thing the
			    customer has to change in them. */}
			<Sheet
				open={show}
				onClose={() => setShow(false)}
				title={t(
					editing
						? "account.addresses.form.editTitle"
						: "account.addresses.form.title",
				)}
				closeLabel={t("action.close")}
				// One full-height snap, the value `./filter-sheet` documents: a fraction below 1
				// turns into a real push once the panel is taller than that share of the screen,
				// which parks the form's own buttons past the bottom edge with nothing left to
				// bring them back. `maxHeight` is what stops the panel growing past the screen.
				snapPoints={[1]}
				// The one sheet in the app with a field in it, and `./sheet` asks for this
				// explicitly: on iOS the body lifts with the keyboard, and without it the field
				// being typed into sits under the keyboard.
				avoidKeyboard
			>
				<AddressForm
					key={editing?.id ?? "new"}
					address={editing}
					onDone={() => setShow(false)}
				/>
			</Sheet>

			{/* After the form, so it draws over it — the two are never open at once, and a delete
			    that opened under an open form would be a question nobody can see. */}
			<ConfirmSheet
				open={removing !== null}
				onClose={() => setRemoving(null)}
				title={t("account.addresses.deleteConfirm")}
				body={removing?.line1}
				confirmLabel={t("action.delete")}
				onConfirm={confirmRemove}
			/>
		</>
	);
}

function AddressForm({
	address,
	onDone,
}: {
	address: Address | null;
	onDone: () => void;
}) {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { show } = useToast();
	const [label, setLabel] = useState(address?.label ?? "");
	const [line1, setLine1] = useState(address?.line1 ?? "");
	const [city, setCity] = useState(address?.city ?? "");
	const [region, setRegion] = useState(address?.region ?? "");
	/**
	 * Seeded from the address, so the control renders the value the save will write.
	 *
	 * Starting at `false` with the payload doing `makeDefault || address.isDefault` would have
	 * been shorter and a lie: editing the address that is already the default would draw an
	 * unchecked box that saved `true`, and unchecking it would change the box and not the
	 * write. The seed is one expression; the disagreement would have been permanent.
	 */
	const [makeDefault, setMakeDefault] = useState(address?.isDefault ?? false);
	/**
	 * The save, confirmed where it happened.
	 *
	 * A write is confirmed where it happened (Rule 5) and here that place is a *sheet that
	 * closes*: the success path invalidates the list and dismisses the panel, so the customer's
	 * view of what they just did is a panel disappearing and a list they now have to re-read. The
	 * toast is the confirmation, it arrives with the change, and its sentence is
	 * `account.addresses.saved` — a key the dictionary has carried for this exact write with
	 * nothing consuming it until now, which is why nothing new is added here.
	 *
	 * Shown before the invalidation rather than after: the write has already been accepted by the
	 * API at this point, and the refetch is bookkeeping the customer should not have to wait
	 * behind to be told the address was saved.
	 */
	const save = useMutation(
		trpc.users.saveAddress.mutationOptions({
			onSuccess: async () => {
				show(t("account.addresses.saved"));
				// The same scope as the delete above, and the same reason.
				await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
				onDone();
			},
		}),
	);
	return (
		<View style={styles.formFields}>
			<Field
				label={t("address.label")}
				value={label}
				onChangeText={setLabel}
				maxLength={40}
			/>
			<Field
				label={t("address.line1")}
				value={line1}
				onChangeText={setLine1}
				maxLength={200}
				autoComplete="street-address"
			/>
			<Field
				label={t("address.city")}
				value={city}
				onChangeText={setCity}
				maxLength={80}
			/>
			<Field
				label={t("address.region")}
				value={region}
				onChangeText={setRegion}
				maxLength={80}
			/>
			{/* The second default the save can carry. `choiceRole="checkbox"` and not a radio:
			    the flag is a fact about this address alone, and a radio would promise that
			    choosing it unchose another — which is true server-side but is not a choice this
			    form is making, because the other addresses are behind the sheet. `selected`
			    draws the tick and sets `accessibilityState.checked`, so the state is a mark and
			    a word rather than only the fill, which is the same rule `./status-badge` is
			    built on. */}
			<Button
				label={t("account.addresses.makeDefault")}
				variant="secondary"
				fullWidth
				selected={makeDefault}
				choiceRole="checkbox"
				onPress={() => {
					selection();
					setMakeDefault((on) => !on);
				}}
			/>
			{/* The heading is the write's own sentence rather than `state.error.title`: nothing
			    was being loaded, and the customer has just pressed Guardar. The API's sentence
			    under it says what it refused, which is the part they can act on — a region it
			    does not deliver to, a phone it cannot parse. */}
			{save.error ? (
				<ErrorState
					error={save.error}
					title={t("account.addresses.saveFailed")}
				/>
			) : null}
			<Button
				label={t("action.save")}
				loading={save.isPending}
				onPress={() =>
					save.mutate({
						...address,
						id: address?.id,
						label: label.trim(),
						line1: line1.trim(),
						city: city.trim(),
						region: region.trim(),
						country: address?.country ?? "CR",
						// The `||` restates the seed above rather than replacing it: the address
						// that is already the default stays the default, written at the point that
						// decides. It is what keeps an edit that never touched the control from
						// clearing the flag the checkout reads.
						isDefault: makeDefault || (address?.isDefault ?? false),
					})
				}
			/>
			{/* Off for as long as the save is. The pair at the foot of this form is one
			    decision, and only one of them is honest while the write is out: the Save button
			    above goes busy, so a Cancel that still answers a tap offers to abandon a write
			    that has already been accepted — `onSuccess` above shows the confirmation and
			    closes the sheet, so the customer who took that offer gets a toast for an address
			    they believed they had dropped.

			    What stays open is every way out of the panel that belongs to `./sheet` — the
			    backdrop, the handle, the close control and Android's back — because this app
			    does not close an exit for the duration of a request an unbounded transport
			    cannot end (`app/(auth)/sign-in.tsx`, "The exit is not disabled while a request
			    is out"). What goes is only this control's offer to cancel *this* write. */}
			<Button
				variant="ghost"
				label={t("action.cancel")}
				disabled={save.isPending}
				onPress={onDone}
			/>
		</View>
	);
}

/**
 * The list in grey, at the size of the rows that will replace it.
 *
 * The blocks are `./list-row`'s rhythm — the same `media.row` picture slot, the same `space.md`
 * between the parts and around them, the same two text lines at `body` and `label` — because a
 * skeleton whose row is a step shorter than the real one is the jump it exists to prevent.
 * Two, because a customer's address book is rarely longer than that on the way in.
 */
function AddressSkeleton({ label }: { label: string }) {
	return (
		<View accessible accessibilityRole="progressbar" accessibilityLabel={label}>
			{[0, 1].map((index) => (
				<View key={index} style={styles.skeletonRow}>
					<Skeleton style={styles.skeletonThumb} radiusToken="md" />
					<View style={styles.skeletonLines}>
						<Skeleton style={{ width: "40%", height: type.body.lineHeight }} />
						<Skeleton style={{ width: "70%", height: type.label.lineHeight }} />
					</View>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	// The frame the scroll and the sheet divide between them: the body's full height, and none
	// of its padding. See the note at the screen's call site.
	frame: { flex: 1, paddingHorizontal: 0 },
	// The body's own rhythm, which the wrap the scroll replaced used to hold — and the gutter
	// the rows' delete buttons used to sit inside. `paddingBottom` is set at the call site
	// from the safe-area inset.
	scroll: { paddingHorizontal: space.lg, gap: space.lg },
	// The rows are one block, so they carry no gap of their own: the hairline each entry draws
	// is what separates them, and `space.lg` between two hairline rows would be a column of
	// floating lines rather than a list.
	entry: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.xs,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	entryLast: { borderBottomWidth: 0 },
	entryRow: { flex: 1 },
	// The `MIN_TOUCH_TARGET` square comes from `./pressable`'s own floor, so this only centres
	// the glyph in it — the glyph is 18 and the target is 44.
	entryAction: { alignItems: "center", justifyContent: "center" },
	// The fields' own rhythm, and the whole of the sheet body's layout: the panel's title is
	// drawn by `./sheet` above this, with its own `space.lg` and margin. It is the same step
	// the other field stacks in this app pay — `app/profile`'s `content` and
	// `app/change-password`'s `content` are both `space.lg` — because a form is a form
	// wherever it is drawn.
	formFields: { gap: space.lg },
	skeletonRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		minHeight: MIN_TOUCH_TARGET,
		paddingVertical: space.md,
	},
	skeletonThumb: { width: media.row, height: media.row },
	skeletonLines: { flex: 1, gap: TEXT_STACK_GAP },
});

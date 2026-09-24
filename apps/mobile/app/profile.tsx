import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Platform,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Skeleton, useSkeletonHold } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { useApiFailure } from "@/lib/api-error";
import { marketplaceAuth } from "@/lib/auth/client";
import { useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";
import { MIN_TOUCH_TARGET, space, type } from "@/theme";

/**
 * The fields a customer owns: name, phone, and now the email itself.
 *
 * The email used to be shown and locked, and the screen said why: `user.email`
 * is the identifier Better Auth matches on, and moving it needed a
 * re-verification flow this app does not have. That flow is still absent — no
 * mailer is configured — but `apps/api/src/auth.ts` now enables the endpoint's
 * unverified branch instead, so the field is real: one Guardar writes the name
 * and phone through `users.updateProfile` and then the email through
 * `/auth/change-email`, re-reads `users.me`, and only confirms when the row
 * agrees. A 200 on a taken address changes nothing (anti-enumeration), which
 * is why the compare — and the `emailInUse` sentence when it differs — exists.
 *
 * ## The completion line is read from stored fields, and only those
 *
 * It counts the fields this screen can actually fill — the name and the phone — against the
 * values the *server* is holding, re-read after a save lands. It does not count unsaved
 * keystrokes, because "complete" would then be a claim the API has not agreed to; and it
 * does not count the avatar, which is a stored field with no control on this screen, because
 * a step nobody can take is not progress, it is a permanent complaint.
 *
 * The number in the sentence is real. There is no percentage, no bar and no head start —
 * `docs/design-mobile.md` permits endowed progress only when the head start is work the
 * reader actually did, and here the honest reading of "2 of 2" is the only one available.
 *
 * ## The save action is pinned, and why the bar is not inside the frame
 *
 * The button used to be the last block of the form, which made it the first thing to leave
 * the screen: a customer edits their name, scrolls, and the control that commits the edit is
 * below the fold on a phone with the keyboard up. `./action-bar` is the thing at the bottom
 * of a screen that says what happens next, and `docked` is the form's variant of it — full
 * width and flat, because a card floating over the field being typed in covers the thing the
 * reader is looking at.
 *
 * It is a **sibling of `Screen`**, not a child of it, and that is a measurement rather than a
 * preference: `ActionBar` draws edge to edge and pays its own bottom inset, while `Screen`
 * pads its body by `space.lg`. A docked bar inside that body would be a bar sixteen points in
 * from each edge, with a hairline that stops short of both and a button padded twice — a
 * floating card with none of a floating card's elevation. So this screen is a column: the
 * frame scrolls, the bar does not. `Screen` therefore gets no `bottomInset` — the bar is what
 * pays it, and paying it in both places is the version with a 34pt gap above the bar.
 *
 * The cost of that structure is that the form's state has to sit above the frame instead of
 * inside it, which is why it is a hook (`useProfileForm`) and the fields are a presentational
 * `ProfileFields`. Nothing else changed: the read is `enabled: signedIn`, exactly as
 * `app/account.tsx` reads the same profile, and `SignedIn` still frames the waiting
 * spinner and the signed-out sentence *inside* the `Screen`, so neither of them is a bare
 * sentence at the top of a screen with no title.
 *
 * The bar still sits behind the keyboard with the keyboard up, and that has not changed:
 * nothing in this app lifts a docked bar, and `./sheet` is the only component that has to
 * move one, because a modal would otherwise cover its own input. What the fields gained is
 * `keyboardInsets` on the frame — the iOS scroll view pays the keyboard's height as its own
 * content inset, which is what keeps the field being typed in above the keyboard rather than
 * under it (`components/screen.tsx:40-68`), and Android gets no value for it because its
 * window is already resized by the keyboard. So the two fields are reachable with the
 * keyboard up, and the reader still puts the keyboard away — by dragging the form, which
 * both platforms do (`screen.tsx:171-173`) — before pressing the bar.
 *
 * ## The save is confirmed once, by the toast, and the line below the fields is not it
 *
 * `docs/design-mobile.md`'s Rule 5 puts a write's confirmation in `./toast`, and this screen
 * used to say it twice: the reserved line under the fields carried `account.profile.saved`
 * when the mutation succeeded, and the completeness line at the top of the form carried the
 * same key when nothing was missing. Only one of those was true, and it was the wrong one —
 * a customer who had changed nothing and saved nothing was told "Perfil guardado". The
 * completeness line is `account.profile.complete` now, which states the state it is actually
 * describing, and the save event is announced once, in the toast that Rule 5 asks for. What
 * is left in the reserved line is the refusal, which is where a failure belongs: a sentence,
 * at the end of the form, directly under the fields it is about.
 *
 * ## The form enters once and then nothing on it moves
 *
 * The blocks arrive in reading order (`./animate-in`): the completion line, the two fields, the
 * account's email, the reserved line that carries the save result. It is the only animation on
 * this screen.
 *
 * There is no `reorder` here, and this is the screen where adding one would be most wrong. The
 * form is built so that it never reflows at all: `./field` reserves a `minHeight` slot under
 * every input and this file reserves one under the last field, and those reserved slots are why
 * a validation sentence or a save result appears *inside* a line that was already there instead
 * of pushing the sentence below it down. A layout transition would have nothing to animate — and
 * what it would cost is real: a `layout` prop registered around a focused `TextInput` re-measures
 * on every layout pass while the keyboard is up, which is the business the reserved slots exist
 * to keep this form out of. `AnimateIn` without `reorder` registers no transition at all; it is
 * one transform that settles in 240ms and is then identity.
 */
export default function Profile() {
	const { t } = useT();
	const form = useProfileForm();

	return (
		<View style={styles.root}>
			<Screen
				title={t("account.profile.title")}
				scroll
				// Two text inputs and the email read-out under them: the frame is what knows which
				// platform needs the keyboard's height paid as an inset, so the screen asks for it
				// rather than measuring anything itself.
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					{form.waiting ? (
						<ProfileSkeleton loadingLabel={t("state.loading")} />
					) : form.failed ? (
						<ErrorState error={form.error} onRetry={form.retry} />
					) : form.stored ? (
						<ProfileFields form={form} />
					) : (
						// Signed in, settled, and nothing stored: the cache was emptied
						// (a user change resets it) and the re-read has not attached yet.
						// The waiting shape, never nothing — a title over a blank body is
						// the screen this sentence exists to prevent.
						<ProfileSkeleton loadingLabel={t("state.loading")} />
					)}
				</SignedIn>
			</Screen>

			{/* Drawn only when the form it saves is on screen. A "Guardar" over a skeleton, over a
			    failure or over the signed-out sentence is a control for something that is not
			    there, and it is the one control on this screen that cannot be walked past. */}
			{form.ready ? (
				<ActionBar
					docked
					primary={{
						label: t("action.save"),
						onPress: form.submit,
						loading: form.saving,
						disabled: form.saving,
					}}
				/>
			) : null}
		</View>
	);
}

/**
 * The digits a phone number has to have, taken from the API's own bounds.
 *
 * `phoneSchema` in `@pymeshub/shared` accepts 8 to 15 digits after stripping separators, and
 * both ends are repeated here so the reader is told before the round trip. The transform in
 * that schema is why the comparison is on digits rather than on the typed string: "8888-8888"
 * is eight digits and is a number this app should accept.
 */
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

/**
 * The address shape worth stopping for before the round trip — `local@host.tld`
 * and nothing finer. The server takes `z.email()`; anything stranger reaches
 * the endpoint and its refusal lands in the reserved line.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The form's state, above the frame rather than inside it.
 *
 * Everything that is a decision lives here and `ProfileFields` only draws it. The split exists
 * for one structural reason — the save bar is a sibling of `Screen` and so cannot be rendered
 * by anything inside it (see the note at the top of this file) — and it is kept honest by
 * `Profile` being the only caller: there is one copy of this state and one place it is read.
 *
 * The read is `enabled: signedIn` rather than gated by `SignedIn`, because the query now runs
 * outside the gate. Same behaviour, one line earlier: signed out, there is no profile to ask
 * for, and the API would answer 401 to the query either way.
 */
function useProfileForm() {
	const { t } = useT();
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { status } = useSession();
	const toast = useToast();

	const signedIn = status === "signed-in";
	const query = useQuery(
		trpc.users.me.queryOptions(undefined, { enabled: signedIn }),
	);

	// `null` means "the reader has not touched this yet", which is not the same as an empty
	// string: an empty string is somebody who deliberately cleared the field.
	const [name, setName] = useState<string | null>(null);
	const [phone, setPhone] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [blurred, setBlurred] = useState({
		name: false,
		phone: false,
		email: false,
	});
	const [submitted, setSubmitted] = useState(false);
	const inFlight = useRef(false);
	// What the email step decided, when the profile step already succeeded. Kept
	// apart from the mutation's own error because the two writes fail for
	// different reasons about different fields.
	const [emailFailure, setEmailFailure] = useState<string | null>(null);
	const [emailSaving, setEmailSaving] = useState(false);
	const requestedEmail = useRef<string | null>(null);

	const save = useMutation(
		trpc.users.updateProfile.mutationOptions({
			onSuccess: async () => {
				// The email moves second, only when it actually moved. The
				// comparison is case-insensitive because the endpoint lowercases
				// what it stores, and a reader who only changed "María@x" to
				// "maría@x" asked for nothing.
				const target = requestedEmail.current;
				const current = stored?.email.trim().toLowerCase() ?? "";
				if (target && target !== current) {
					setEmailSaving(true);
					try {
						await marketplaceAuth.changeEmail(target);
					} catch {
						// A refusal here is about the address, not the name and
						// phone the mutation just saved — those already landed.
						// The re-read below still runs, so the screen shows what
						// is true rather than what was hoped for.
						setEmailFailure(t("auth.error.generic"));
						await cache.invalidateQueries({
							queryKey: trpc.users.pathKey(),
						});
						return;
					} finally {
						setEmailSaving(false);
					}
					await cache.invalidateQueries({
						queryKey: trpc.users.pathKey(),
					});
					// 200-on-taken: the endpoint answers success while changing
					// nothing when the address belongs to somebody else, so the
					// re-read row is the verdict, not the status.
					const fresh = await query.refetch();
					if (fresh.data?.email.trim().toLowerCase() === target) {
						toast.show(t("account.profile.saved"));
					} else {
						setEmailFailure(t("auth.error.emailInUse"));
					}
					return;
				}
				// The confirmation, from `./toast` and from nowhere else on this screen. Shown
				// before the await, because the write has already happened and the re-read is
				// the app's business rather than the reader's — the sentence is not about the
				// refresh. `show` takes the finished string, so `t(...)` is called here.
				toast.show(t("account.profile.saved"));
				// The procedure's own key root. A profile write moves `users.*` and nothing else,
				// and keyless this was `invalidateQueries()` with no argument — every mounted
				// query in the client marked stale and refetched, for a name field. Same call the
				// order screens already scope the same way (`lib/trpc/context.ts` says why).
				await cache.invalidateQueries({ queryKey: trpc.users.pathKey() });
			},
		}),
	);
	const failure = useApiFailure(save.error);

	const waiting = useSkeletonHold(
		status === "loading" || (signedIn && query.isPending),
	);
	const stored = query.data;

	const nameValue = name ?? stored?.name ?? "";
	const phoneValue = phone ?? stored?.phone ?? "";
	const emailValue = email ?? stored?.email ?? "";

	// Derived, never stored. A second copy of "is this valid" is a second answer, and the
	// second one is the one that goes stale.
	const problems = useMemo(() => {
		const found: Partial<Record<"name" | "phone" | "email", string>> = {};

		if (!nameValue.trim()) found.name = t("form.required");

		const digits = phoneValue.replace(/\D/g, "");
		if (phoneValue.trim() && digits.length < MIN_PHONE_DIGITS) {
			found.phone = t("form.tooShort", { min: MIN_PHONE_DIGITS });
		} else if (digits.length > MAX_PHONE_DIGITS) {
			found.phone = t("form.tooLong", { max: MAX_PHONE_DIGITS });
		}

		// The server takes `z.email()`; this is the shape worth stopping for
		// before the round trip, not a second implementation of it. Anything
		// stranger than this reaches the endpoint and its refusal lands in the
		// reserved line as the generic sentence.
		if (!EMAIL_SHAPE.test(emailValue.trim())) {
			found.email = t("account.profile.emailInvalid");
		}

		return found;
	}, [nameValue, phoneValue, emailValue, t]);

	const messageFor = (field: "name" | "phone" | "email"): string | null =>
		submitted || blurred[field] ? (problems[field] ?? null) : null;

	/**
	 * The sentence the reserved line carries, and it is only ever the refusal.
	 *
	 * `failure.message` is `useApiFailure`'s reading of the refusal — the API's `domainCode`
	 * first, then its tRPC code — so a name the server rejected for a length rule says so
	 * instead of "no pudimos guardar los cambios", which tells the reader nothing they can act
	 * on. It sits in a line reserved at the end of the form, directly under the fields it is
	 * about, so a refusal never moves anything and never arrives far from the fields that
	 * caused it. The success has no sentence here: it is the toast (Rule 5), which leaves one
	 * confirmation on this screen rather than two. The email step's own refusal joins the
	 * same line — the two writes share one form, so they share one sentence, and the
	 * profile half is reported by the mutation while the email half sets its own.
	 */
	const message = save.isError ? failure.message : emailFailure;

	/**
	 * And on iOS it is read out, because that is the only platform where nothing else will.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the
	 * assertion in `ProfileFields` is the whole of Android's announcement of this sentence,
	 * and iOS, which ignores the prop, has to be told. Guarded by the platform rather than
	 * announced on both: a sentence a live region has already spoken is not read twice, it is
	 * read as two sentences. It fires on the sentence changing, which is the moment the
	 * refusal reached the screen — and not on the keystroke that clears it, because `message`
	 * is null by then.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !message) return;
		AccessibilityInfo.announceForAccessibility(message);
	}, [message]);

	/**
	 * Editing drops whatever the last press left, success or failure.
	 *
	 * The confirmation cannot go stale any more — the toast leaves on its own 3.2s clock and
	 * never sat in this layout — but either refusal can: each was about values already
	 * replaced by the keystroke. `reset()` also puts the mutation back in its idle state,
	 * which is what makes the next press a fresh one.
	 */
	const edited = useCallback(
		(apply: () => void) => {
			apply();
			setEmailFailure(null);
			if (save.isError || save.isSuccess) save.reset();
		},
		[save],
	);

	const submit = useCallback(() => {
		if (inFlight.current) return;
		setSubmitted(true);
		if (Object.keys(problems).length > 0) return;

		inFlight.current = true;
		// Captured now, read when the profile write lands: the fields stay
		// editable while the mutation is in flight, and the comparison in
		// `onSuccess` must be against what Guardar was pressed on.
		requestedEmail.current = emailValue.trim().toLowerCase();
		// An empty phone is sent as `undefined` rather than `""`: the API's schema trims and
		// then demands 8 digits, and sending the empty string is a rejection for a field the
		// reader deliberately left blank.
		save.mutate(
			{ name: nameValue.trim(), phone: phoneValue.trim() || undefined },
			{ onSettled: () => (inFlight.current = false) },
		);
	}, [emailValue, nameValue, phoneValue, problems, save]);

	/**
	 * How many of the two fillable fields the *server* is still missing.
	 *
	 * Read off `stored` rather than off the inputs, so the sentence counts what has been saved
	 * and not what has been typed. Zero while the read is in flight, which is the safe reading:
	 * the line is not rendered until `stored` exists.
	 */
	const missing = useMemo(() => {
		if (!stored) return 0;
		return [
			stored.name.trim().length > 0,
			(stored.phone ?? "").trim().length > 0,
		].filter((present) => !present).length;
	}, [stored]);

	return {
		waiting,
		failed: query.isError,
		error: query.error,
		retry: () => query.refetch(),
		stored,
		ready: signedIn && !!stored,
		missing,
		nameValue,
		phoneValue,
		emailValue,
		nameError: messageFor("name"),
		phoneError: messageFor("phone"),
		emailError: messageFor("email"),
		edited,
		setName,
		setPhone,
		setEmail,
		setBlurred,
		message,
		submit,
		saving: save.isPending || emailSaving,
	};
}

/**
 * What the hook hands over, spelled by inference rather than by hand.
 *
 * A written-out shape here would be a second copy of the API's own — `stored` alone is the
 * whole `users.me` row — and the copy is the half that goes stale when the API grows a field.
 */
type ProfileForm = ReturnType<typeof useProfileForm>;

/** The fields, and nothing else: every value here is `useProfileForm`'s. */
function ProfileFields({ form }: { form: ProfileForm }) {
	const { t, tp } = useT();
	const { fontScale } = useWindowDimensions();

	return (
		<View style={styles.content}>
			<AnimateIn index={0}>
				<Text variant="label" tone="muted" accessibilityLiveRegion="polite">
					{form.missing === 0
						? t("account.profile.complete")
						: tp("biz.onboarding.pending", form.missing)}
				</Text>
			</AnimateIn>

			<AnimateIn index={1}>
				<Field
					label={t("account.profile.name")}
					value={form.nameValue}
					onChangeText={(value) => form.edited(() => form.setName(value))}
					onBlur={() => form.setBlurred((was) => ({ ...was, name: true }))}
					error={form.nameError}
					autoComplete="name"
					maxLength={120}
				/>
			</AnimateIn>
			<AnimateIn index={2}>
				<Field
					label={t("account.profile.phone")}
					value={form.phoneValue}
					onChangeText={(value) => form.edited(() => form.setPhone(value))}
					onBlur={() => form.setBlurred((was) => ({ ...was, phone: true }))}
					error={form.phoneError}
					keyboardType="phone-pad"
					autoComplete="tel"
					help={t("auth.field.phone.help")}
				/>
			</AnimateIn>

			<AnimateIn index={3}>
				<Field
					label={t("account.profile.email")}
					value={form.emailValue}
					onChangeText={(value) => form.edited(() => form.setEmail(value))}
					onBlur={() => form.setBlurred((was) => ({ ...was, email: true }))}
					error={form.emailError}
					keyboardType="email-address"
					autoComplete="email"
					autoCapitalize="none"
				/>
			</AnimateIn>

			{/* Reserved, because it is the sentence that appears once the button below it has been
			    pressed — the one moment the reader is looking at both. The button is in the bar
			    now and cannot move, but this line still holds its own `body` line whether or not
			    there is anything in it, so the form does not reflow around a refusal either.
			    It holds only a refusal: the confirmation is the toast (Rule 5). */}
			<AnimateIn index={4}>
				<View
					style={[
						styles.status,
						// Composed with the reader's font scale: a reserve frozen at 100% metrics is
						// short of the `body` line it holds at 200%, and the form would reflow
						// around a refusal exactly as if nothing were reserved.
						{ minHeight: Math.round(type.body.lineHeight * fontScale) },
					]}
				>
					{form.message ? (
						<Text
							variant="body"
							tone="destructive"
							accessibilityRole="alert"
							accessibilityLiveRegion="assertive"
						>
							{form.message}
						</Text>
					) : null}
				</View>
			</AnimateIn>
		</View>
	);
}

/**
 * The form in grey, in the shape it will have.
 *
 * Three labelled inputs at the sizes the real controls occupy — a skeleton whose blocks do not
 * match what replaces them is a second, smaller layout jump. One block carries the label so the
 * wait is announced once.
 *
 * The label lines are composed with the reader's font scale, because a skeleton frozen at
 * 100% metrics is eight points short of a real line at 200% (`docs/design-mobile.md`,
 * Waiting) — the same composition `app/orders`' skeleton uses. The input blocks are not: they
 * stand in for controls, and keep the floor a control owns.
 */
function ProfileSkeleton({ loadingLabel }: { loadingLabel: string }) {
	const { fontScale } = useWindowDimensions();
	// A line of real text, at the height the variant it stands in for draws it.
	const line = (variant: keyof typeof type) =>
		Math.round(type[variant].lineHeight * fontScale);

	return (
		<View style={styles.content}>
			<Skeleton
				label={loadingLabel}
				style={{ width: "35%", height: line("label") }}
			/>
			<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
			<Skeleton style={{ width: "35%", height: line("label") }} />
			<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
			<Skeleton style={{ width: "35%", height: line("label") }} />
			<Skeleton style={{ height: MIN_TOUCH_TARGET }} />
		</View>
	);
}

const styles = StyleSheet.create({
	// The column: the frame takes what is left above the bar. `flex: 1` rather than a height,
	// because the bar's own height depends on the reader's text size and the bottom inset.
	root: { flex: 1 },
	content: { gap: space.lg },
	// The reserved line's centre, and nothing more: its `body`-line reserve is composed with
	// the reader's font scale at the call site, because a reserve frozen at 100% metrics is
	// short of the line it holds at 200%.
	status: { justifyContent: "center" },
});

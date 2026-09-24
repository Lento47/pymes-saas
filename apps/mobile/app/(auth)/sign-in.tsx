import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import { getAccountProfile, setAccountProfile } from "@/lib/device-prefs";
import { useT } from "@/lib/i18n";
import { icon, space, type, useTheme } from "@/theme";

/**
 * Entering, and creating, an account.
 *
 * One component for both because the two forms differ by a name field, a password rule and
 * two words — and two components would be two places for the submit guard, the validation
 * and the error slot to drift apart. `sign-up.tsx` passes `signingUp`.
 *
 * ## Waiting
 *
 * This is one of the two states `docs/design-mobile.md` keeps a spinner for: the shape of
 * the answer genuinely is not known until the Worker replies. The busy state is said three
 * ways and none of them is movement — the submit button stops accepting taps and dims, the
 * spinner replaces its label inside the control the reader just pressed, and the slot under
 * the fields carries the word "Cargando…". A reader who cannot see a rotating ring is told
 * the same thing by the word and by the button's own `busy` accessibility state.
 *
 * The wait is longer than this screen's own round trip: a sign-in that the API accepted is
 * followed by the session read that decides whether it meant anything, and the busy state
 * stays up until that has an answer — see "Success is the session's answer, not the call's"
 * below.
 *
 * ## The action is on the floor, not at the end of the form
 *
 * The submit used to be the last thing in the scroll: the mark, up to three fields and the
 * reserved status slot came first, so at 200% text on a small phone the one control this
 * screen exists for sat below the fold and the reader had to scroll to reach it. The control
 * does not get to be the hardest one to press on the screen it is the point of.
 * `app/profile.tsx:127-139` had already moved the same control out of its own form into a
 * docked `./action-bar` for that reason, and this is that shape.
 *
 * The bar pays its own bottom inset (`./action-bar`'s docblock), so `bottomInset` came off
 * `Screen` in the same edit rather than being paid twice — the frame is no longer the thing
 * next to the home indicator. `keyboardInsets` stays on the frame, where the fields are.
 *
 * The toggle and the way out stay in the form: the screen is not those, and the bar holds one
 * action. What the reserved slot under the fields protects now is them — see its own note.
 *
 * ## Why the double-tap guard is a ref as well as a disabled button
 *
 * `Button` already renders `disabled` while `loading`, and that is what a sighted reader
 * sees. It is not enough on its own: two taps inside one frame are both handled before React
 * re-renders, so both would start a round trip. `inFlight` is the guard that closes that
 * window, and it is a ref precisely because it must change synchronously.
 *
 * ## When validation speaks
 *
 * A field is checked when it loses focus and when the form is submitted, never on the first
 * keystroke — a box that turns red while somebody is still typing their address is a form
 * arguing with its reader. `components/field.tsx` reserves the line the sentence appears on,
 * so none of this reflows the form or moves the field a thumb is travelling towards.
 *
 * ## The courier is identified at the door
 *
 * Delivery is a dedicated use — an account that exists to accept and deliver — and the
 * identification happens here, where the session is made, not in a setting the reader
 * finds afterwards. The two-segment group above the fields asks what the session is for:
 * shopping, or the courier's board. It is the same credential either way — one account,
 * one email, one password — and the answer decides only where the verified session lands
 * (`/(delivery)` or `/`) and which device preference is written, which is exactly what
 * `lib/role.ts` reconciles at cold start.
 *
 * The group answers from the device's own last choice (`getAccountProfile`), so a courier
 * signing back in finds "Repartidor" already selected and lands on their board; a fresh
 * install answers "Cliente". The help line under the delivery choice states the dedicated
 * use in the dictionary's words — it is the reason this choice exists at all — and it
 * appears with the selection rather than always, because for a customer it would be a
 * sentence about somebody else.
 *
 * The choice is disabled while the wait is open, the same rule as the form-switch button:
 * a role swapped mid-flight would change where the in-progress session is about to land.
 *
 * ## The mark
 *
 * A glyph and the app's name, above the form, composed here from type and the existing
 * tokens. There is no logo asset in this app and this screen does not add one: a bundled
 * image would be a file to keep in a density per platform and a second thing that can
 * disagree with the palette, while the palette and the type scale are already the two things
 * every screen agrees with. The glyph is `storefront-outline` — the storefront glyph this app
 * uses for the marketplace, so the lockup is the app's
 * own vocabulary rather than a new symbol — drawn at `icon.action` in `colors.primary`. It
 * is hidden from the accessibility tree: the wordmark beside it is the name, and a glyph
 * with no label of its own is announced as nothing at all.
 *
 * The lockup cannot be `Screen`'s `title`. `Screen` renders its title strip before its
 * children, so nothing in the body can sit above it, and the strip is one string while this
 * is three nodes. So this screen asks for no `title` and composes the strip itself — the
 * route `app/store/[slug].tsx` takes for the same reason — which means paying the two
 * numbers the strip paid: `space.md` above it and `space.xs` between the title and its
 * subtitle (`components/screen.tsx:196-197`). The form title stays the loudest thing on the
 * screen (Rule 1); the wordmark above it is `type.heading` and does not compete.
 *
 * ## The keyboard
 *
 * `keyboardInsets`, because this is a screen whose whole content is inputs: the iOS scroll
 * view pays the keyboard's height as its own content inset so the field being typed in
 * stays above it, and Android is handed no value because its window is resized by the
 * keyboard instead (`screen.tsx:40-68`). Nothing here measures a keyboard.
 *
 * ## The failure is the API's sentence, in the one slot, and only while it is true
 *
 * The three keys the transport can produce are the three it names —
 * `auth.error.invalidCredentials` for a 401, `auth.error.rateLimited` for a 429,
 * `auth.error.generic` for everything else (`packages/auth/src/marketplace-client.ts:30-40`)
 * — and `authErrorKey` reduces the thrown message to that same set of three before it
 * reaches this screen (`lib/auth/session.tsx:280-286`). That whitelist is what makes the
 * `MessageKey` cast below a checked claim rather than a hope; without it the cast would be
 * printing a raw key into the slot the first time a transport grew a fourth one.
 *
 * The sentence is the refusal and nothing else, and typing clears it: it was written about
 * the values that were sent, and it is also a live region, so leaving it up announces an
 * attempt the reader has already moved past. `app/profile.tsx` drops its refusal on the same
 * event for the same reason.
 *
 * The announcement is split by platform, because the platforms are: `accessibilityLiveRegion`
 * is Android's alone — RN declares it on `AccessibilityPropsAndroid` with `@platform android`
 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the slot
 * announces the sentence there, and iOS, which has no counterpart, gets it from
 * `AccessibilityInfo.announceForAccessibility` on the change that produced it. One platform
 * each and never both: a sentence a live region has already spoken is not read twice, it is
 * read as two sentences.
 *
 * ## The exit is not disabled while a request is out
 *
 * `fetch` in the transport takes no `AbortController` (`marketplace-client.ts:21-29`), so a
 * request that never answers is a wait with no timeout and nothing in this app can end it —
 * which makes the back button the reader's only way out of a wait the app cannot bound. A
 * form that disables its own exit for the duration is the wall `lib/auth/session.tsx:39-48`
 * refuses to build. The form-switch button is a different case and stays disabled: switching
 * mid-flight would start a second request while the reader can no longer see the outcome of
 * the first.
 *
 * ## Success is the session's answer, not the call's
 *
 * `ok` means the API accepted the call. It does not mean a session exists, and this screen
 * used to treat the two as one by navigating from the handler: `signIn` resolves `ok` after
 * `read()`, and `read()` never reports its own outcome — a session read that came back with
 * nothing leaves `status` at `"signed-out"` (`lib/auth/session.tsx:139-140`) and
 * one that failed outright leaves whatever it was (`:156-167`). So the accepted call is
 * recorded in `sent` and the navigation happens in an effect that watches the provider's
 * `status`, which is the only thing on this screen that has actually verified a session. The
 * path where the credential did not take ends on this form with the sentence for it, instead
 * of on the home tab as a stranger.
 */

/**
 * Better Auth's `minPasswordLength` (`apps/api/src/auth.ts`), restated rather than
 * re-decided: copy that disagreed with the server would be the form lying about the one
 * requirement it actually enforces. `auth.password.minimum` carries the same number in words
 * for the help line; this is the number the check is made with.
 */
const MIN_PASSWORD = 12;

/**
 * The shape of an address, and only its shape.
 *
 * Deliberately permissive: it is here to catch a missing `@` before a round trip, not to
 * adjudicate which addresses exist. A stricter expression rejects valid addresses, and
 * rejecting a valid address is a customer who cannot create an account at all.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "name" | "email" | "password";

export default function SignIn() {
	return <SignInForm />;
}

export function SignInForm({ signingUp = false }: { signingUp?: boolean }) {
	const { t } = useT();
	const { colors } = useTheme();
	const auth = useSession();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	/** The API's own sentence, or `null`. The refusal — never the wait, and never "error". */
	const [failure, setFailure] = useState<string | null>(null);
	/**
	 * The API accepted the call. **Not** the same as a session, and the two are kept apart on
	 * purpose — see "Success is the session's answer, not the call's" at the top of this file.
	 */
	const [sent, setSent] = useState(false);
	/** Which fields have been left once, and the whole form has been submitted once. */
	const [blurred, setBlurred] = useState<Record<FieldName, boolean>>({
		name: false,
		email: false,
		password: false,
	});
	const [submitted, setSubmitted] = useState(false);
	// What the session is for, asked at the door (see "The courier is identified at the door"):
	// seeded from the device's own last answer, so a returning courier finds their role selected.
	const [role, setRole] = useState<"customer" | "delivery">(() =>
		getAccountProfile() === "delivery" ? "delivery" : "customer",
	);
	const inFlight = useRef(false);

	// Derived, never stored: a second copy of "is this valid" is a second answer that can go
	// stale. The message is the dictionary's, and the check is the shape of what was typed.
	const problems = useMemo(() => {
		const found: Partial<Record<FieldName, string>> = {};

		if (signingUp && !name.trim()) found.name = t("form.required");

		if (!email.trim()) found.email = t("form.required");
		else if (!EMAIL_SHAPE.test(email.trim()))
			found.email = t("form.invalidEmail");

		if (!password) found.password = t("form.required");
		else if (signingUp && password.length < MIN_PASSWORD) {
			found.password = t("form.tooShort", { min: MIN_PASSWORD });
		}

		return found;
	}, [email, name, password, signingUp, t]);

	/** The sentence for `field`, but only once it is fair to show it. */
	const messageFor = (field: FieldName): string | null =>
		submitted || blurred[field] ? (problems[field] ?? null) : null;

	const leave = (field: FieldName) =>
		setBlurred((was) => ({ ...was, [field]: true }));

	/**
	 * What the reader types, and the one thing typing ends.
	 *
	 * Both halves of the last attempt's outcome go, not just the refusal: a sentence about
	 * values that have since changed is a sentence about nothing, and so is a recorded call
	 * whose session never arrived — the reader is editing the credential that produced it.
	 */
	const typed =
		(apply: (value: string) => void) =>
		(value: string): void => {
			setFailure(null);
			setSent(false);
			apply(value);
		};

	const submit = useCallback(async () => {
		if (inFlight.current) return;

		// Shown before the early return, so pressing the button is what reveals the problems
		// in fields the reader never touched. Nothing is sent.
		setSubmitted(true);
		if (Object.keys(problems).length > 0) return;

		inFlight.current = true;
		setPending(true);
		setFailure(null);
		setSent(false);
		// Announced from the handler that started the wait, not from an effect watching it:
		// this is the reader's own action being acknowledged the moment it is made. iOS only,
		// on the same split as the failure sentence — Android announces the slot's own word
		// through the live region when it mounts, and this would be that word again.
		if (Platform.OS === "ios") {
			AccessibilityInfo.announceForAccessibility(t("state.loading"));
		}

		try {
			const result = signingUp
				? await auth.signUp(email.trim(), password, name.trim())
				: await auth.signIn(email.trim(), password);

			if (result.ok) {
				// The courier's preference is written before the session's answer arrives, so
				// the destination tree (`lib/role.ts`) and the cold-start resolver both read the
				// choice this screen just made. The in-memory copy is set synchronously — the
				// awaited write is storage's, and nothing here needs to await it.
				if (role === "delivery") void setAccountProfile("delivery");
				// Recorded, not navigated from. The effect below navigates on the provider's
				// verified status; this handler only knows the call was accepted.
				setSent(true);
				return;
			}
			// The transport has already reduced the response to one of three keys — a 401, a
			// 429, or everything else — and this renders the key rather than inventing a
			// sentence. A rate limit reads "Demasiados intentos seguidos"; collapsing it into
			// "no pudimos entrar" would hide the one thing the reader can act on.
			setFailure(t(result.messageKey as MessageKey));
		} finally {
			// In `finally` because a throw on the way out must not leave the form permanently
			// busy — a submit button that never comes back is a screen the customer has to
			// close the app to escape.
			inFlight.current = false;
			setPending(false);
		}
	}, [auth, email, name, password, problems, role, signingUp, t]);

	/**
	 * A call the API accepted that produced no session.
	 *
	 * The session read that follows a sign-in has exactly two ways to end at `"signed-out"`:
	 * a 401, which the transport answers by dropping the stored token before it throws
	 * (`packages/auth/src/marketplace-client.ts:31-32`), or a 200 whose body is `null`
	 * (`:65-68`, the ordinary shape of "there is no session"). The provider turns either into
	 * `"signed-out"` (`lib/auth/session.tsx:139-140` and `:150-154`). Read together with
	 * `sent` that means one thing: this form's call was accepted and there is no session
	 * behind it, so the reader is not signed in and has to be told. Without a sentence here
	 * the round trip is over, the button is no longer busy, and the slot is empty — a form
	 * that looks like it worked.
	 *
	 * It is the generic key, and that is the honest one: what reached us is a session read
	 * that came back with nothing, not a credential the API rejected at the door, so "Correo
	 * o contraseña incorrectos" would name a cause nobody reported.
	 */
	const stranded = sent && !pending && auth.status === "signed-out";
	const message = failure ?? (stranded ? t("auth.error.generic") : null);

	/**
	 * Whether the wait is still open, and it outlives this form's own round trip.
	 *
	 * `pending` is this screen's call; the session read that must follow it belongs to the
	 * provider, so the slot keeps saying "Cargando…" until that has an answer too — otherwise
	 * an accepted sign-in followed by a slow session read would show a form at rest with
	 * nothing in it, which is the same lie as an empty slot after a refusal.
	 */
	const waiting = pending || (sent && auth.status === "loading");

	useEffect(() => {
		// The destination, not always the root resolver: the identified courier goes straight to
		// the delivery tree — which its own guard re-resolves from the preference this form just
		// wrote — while everyone else lands at `/`, whose resolver is the one place that knows
		// the three trees.
		if (sent && auth.status === "signed-in")
			router.replace(role === "delivery" ? "/(delivery)" : "/");
	}, [auth.status, sent, role]);

	/**
	 * iOS only, because the slot above is the whole of Android's announcement.
	 *
	 * `accessibilityLiveRegion` is declared on `AccessibilityPropsAndroid` with
	 * `@platform android` (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`),
	 * so Android says the sentence when the slot changes and iOS — which ignores the prop —
	 * has to be told. Announcing on both would say it twice on the platform that already
	 * spoke.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !message) return;
		AccessibilityInfo.announceForAccessibility(message);
	}, [message]);

	const title = t(signingUp ? "auth.signUp.title" : "auth.signIn.title");
	const subtitle = t(
		signingUp ? "auth.signUp.subtitle" : "auth.signIn.subtitle",
	);

	return (
		<View style={styles.root}>
			<Screen
				scroll
				// Asked for by the screen that has the inputs rather than assumed by the frame; the
				// frame is what knows which platform needs the keyboard's height paid.
				keyboardInsets
				contentStyle={styles.content}
			>
				<View style={styles.identity}>
					<View style={styles.mark}>
						<Ionicons
							name="storefront-outline"
							size={icon.action}
							color={colors.primary}
							// Decoration: the wordmark beside it is the name, and a glyph carrying no
							// label of its own is announced as nothing at all.
							accessibilityElementsHidden
							importantForAccessibility="no"
						/>
						<Text variant="heading" bold>
							{t("app.name")}
						</Text>
					</View>
					<View>
						<Text variant="display" bold>
							{title}
						</Text>
						<Text variant="label" tone="muted" style={styles.subtitle}>
							{subtitle}
						</Text>
					</View>
				</View>

				{/* The identification at the door — see "The courier is identified at the door"
				    above. Same credential either way; the answer lands the session. */}
				<View style={styles.role}>
					<Segmented
						label={t("auth.role.label")}
						value={role}
						disabled={waiting}
						onChange={(next) =>
							setRole(next === "delivery" ? "delivery" : "customer")
						}
						options={[
							{ value: "customer", label: t("auth.role.customer") },
							{ value: "delivery", label: t("auth.role.delivery") },
						]}
					/>
					{role === "delivery" ? (
						<Text variant="caption" tone="muted">
							{t("auth.role.deliveryHelp")}
						</Text>
					) : null}
				</View>

				{signingUp ? (
					<Field
						label={t("auth.field.name")}
						value={name}
						onChangeText={typed(setName)}
						onBlur={() => leave("name")}
						error={messageFor("name")}
						autoComplete="name"
						maxLength={120}
					/>
				) : null}
				<Field
					label={t("auth.field.email")}
					value={email}
					onChangeText={typed(setEmail)}
					onBlur={() => leave("email")}
					error={messageFor("email")}
					autoCapitalize="none"
					autoComplete="email"
					keyboardType="email-address"
					autoCorrect={false}
				/>
				<Field
					label={t("auth.field.password")}
					value={password}
					onChangeText={typed(setPassword)}
					onBlur={() => leave("password")}
					error={messageFor("password")}
					secureTextEntry
					autoComplete={signingUp ? "new-password" : "current-password"}
					// The rule is stated before the reader types, not after they break it.
					help={signingUp ? t("auth.password.minimum") : undefined}
					onSubmitEditing={() => void submit()}
				/>

				{/* One slot for both the failure and the wait, and it is reserved: the two controls
			    under it must not move when either appears. The word is the whole waiting state for
			    a reader who is not looking at the spinner. The failure comes first, because a
			    refusal is what the reader acts on and a wait is what they sit through.
			    The submit is not one of the two any more — it is on the bar, which is outside this
			    scroll and moves for nothing the form does — so what the reservation holds still is
			    the toggle and the way out. */}
				<View style={styles.status}>
					{message ? (
						<Text
							variant="body"
							tone="destructive"
							accessibilityRole="alert"
							accessibilityLiveRegion="assertive"
						>
							{message}
						</Text>
					) : waiting ? (
						<Text variant="body" tone="muted" accessibilityLiveRegion="polite">
							{t("state.loading")}
						</Text>
					) : null}
				</View>

				<Button
					variant="ghost"
					label={t(signingUp ? "action.signIn" : "action.signUp")}
					// `waiting`, so the form cannot be swapped out while the session read is still
					// deciding — a fresh form has no `sent` of its own, and the reader would end up on
					// the sign-up screen signed in.
					disabled={waiting}
					onPress={() => router.replace(signingUp ? "/sign-in" : "/sign-up")}
				/>
				{/* Not disabled while the request is out. It is the way out of a wait this app cannot
			    bound — nothing in the transport aborts a request — and an exit closed from the
			    moment a tap is made until the network answers is a screen with no way off it. */}
				<BackButton to="/" />
			</Screen>

			{/* The screen's one action, on the floor rather than at the end of the form — the reasons
		    are in the docblock. `waiting` and not `pending`, as it was inside the scroll: the
		    action is not finished when the call is, it is finished when there is a session, so the
		    control stays busy through the read that confirms it rather than inviting a second
		    credential for one sign-in. */}
			<ActionBar
				docked
				primary={{
					label: t(signingUp ? "auth.signUp.submit" : "auth.signIn.submit"),
					onPress: () => void submit(),
					loading: waiting,
					disabled: waiting,
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	// The scroller and the bar divide the screen between them: the form takes the whole height
	// and the bar is its footer, which is the arrangement `app/profile.tsx` uses for the same
	// pair. A bar outside a `flex: 1` column is a bar with no height to sit under.
	root: { flex: 1 },
	content: { gap: space.lg, paddingTop: space.md },
	identity: { gap: space.md },
	mark: { flexDirection: "row", alignItems: "center", gap: space.sm },
	// `Screen`'s strip put this between the title and its subtitle (`screen.tsx:197`); the strip
	// is composed here now, so the number is paid here.
	subtitle: { marginTop: space.xs },
	// The identification group and its one help line, kept together: the line is the
	// delivery choice's own sentence and must not float free of the control that chose it.
	role: { gap: space.xs },
	// `minHeight` is a floor: at 200% Dynamic Type the sentence and the word both grow past
	// it, and the slot grows with them instead of clipping them.
	status: { minHeight: type.body.lineHeight, justifyContent: "center" },
});

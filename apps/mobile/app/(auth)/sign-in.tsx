import Ionicons from "@expo/vector-icons/Ionicons";
import type { MessageKey } from "@pymeshub/i18n";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { ActionBar } from "@/components/action-bar";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Pressable } from "@/components/pressable";
import { Screen } from "@/components/screen";
import { Segmented } from "@/components/segmented";
import { Text } from "@/components/text";
import { useSession } from "@/lib/auth/session";
import {
	type AccountProfile,
	getAccountProfile,
	setAccountProfile,
} from "@/lib/device-prefs";
import { selection } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { duration, PRESS_SCALE_ROW, STATE_POP, spring } from "@/lib/motion";
import { useReducedMotion } from "@/lib/reduced-motion";
import {
	icon,
	MIN_TOUCH_TARGET,
	radius,
	space,
	TEXT_STACK_GAP,
	type as typeScale,
	useTheme,
} from "@/theme";

/**
 * Entering, and creating, an account.
 *
 * One component for both because the two forms differ by a name field, a password rule and
 * two words ΓÇö and two components would be two places for the submit guard, the validation
 * and the error slot to drift apart. `sign-up.tsx` passes `signingUp`.
 *
 * ## Waiting
 *
 * This is one of the two states `docs/design-mobile.md` keeps a spinner for: the shape of
 * the answer genuinely is not known until the Worker replies. The busy state is said three
 * ways and none of them is movement ΓÇö the submit button stops accepting taps and dims, the
 * spinner replaces its label inside the control the reader just pressed, and the slot under
 * the fields carries the word "CargandoΓÇª". A reader who cannot see a rotating ring is told
 * the same thing by the word and by the button's own `busy` accessibility state.
 *
 * The wait is longer than this screen's own round trip: a sign-in that the API accepted is
 * followed by the session read that decides whether it meant anything, and the busy state
 * stays up until that has an answer ΓÇö see "Success is the session's answer, not the call's"
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
 * `Screen` in the same edit rather than being paid twice ΓÇö the frame is no longer the thing
 * next to the home indicator. `keyboardInsets` stays on the frame, where the fields are.
 *
 * The toggle and the way out stay in the form: the screen is not those, and the bar holds one
 * action. What the reserved slot under the fields protects now is them ΓÇö see its own note.
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
 * keystroke ΓÇö a box that turns red while somebody is still typing their address is a form
 * arguing with its reader. `components/field.tsx` reserves the line the sentence appears on,
 * so none of this reflows the form or moves the field a thumb is travelling towards.
 *
 * ## The door is asked differently by each side
 *
 * Delivery is a dedicated use ΓÇö an account that exists to accept and deliver ΓÇö and the
 * identification happens here, where the session is made, not in a setting the reader
 * finds afterwards. Both forms ask, and they ask different questions because they are
 * different questions:
 *
 * - **Sign-in** offers the same three types as cards, drawn here as a **segment** because
 *   the answer is a claim about this device rather than a decision about a new account:
 *   same credential either way ΓÇö one account, one email, one password ΓÇö and the answer only
 *   decides where the verified session lands (`/(delivery)`, `/(business)` or `/`) and
 *   which device preference is written, which is exactly what `lib/role.ts` reconciles at
 *   cold start. It is a segment and not three cards because three full-width rows with a
 *   promise each would be three sentences to read on the way *back* in, where the reader
 *   has already decided and wants the shortest answer on the screen. The segment answers
 *   from the device's own last choice (`getAccountProfile`), so a courier signing back in
 *   finds "Repartidor" already selected.
 * - **Sign-up** offers the three things an account can be *for*: a business, a customer, a
 *   courier ΓÇö as three **cards** rather than a segment, because each one is a *promise*
 *   ("sell and manage", "buy", "deliver") and a segment has nowhere to put a sentence.
 *   This is `components/option-card`'s argument about prices, in a place where the words
 *   matter more than the count: a control that can only hold a word has to be a different
 *   control. It is `registrationMode`, not `role`, and it is the input the whole sign-up is
 *   shaped by: the title changes to the mode's own, the device profile is written from it,
 *   and success lands on the mode's first screen ΓÇö `/new-business` for the shop,
 *   `/courier-profile` for the courier (their profile and vehicle, before any membership
 *   exists), `/` for the customer. A sign-up that could not express "business" or
 *   "delivery" was a sign-up that silently made every account a customer ΓÇö which is the
 *   failure this group exists to prevent.
 *
 * Two things about that group are decisions rather than layout. **The business card is
 * first and preselected**: the shop is the account this product exists for, and a form that
 * opens on the customer answer has already decided for the reader ΓÇö the customer, who is
 * the exception here, is one tap away. And it sits **below the fields**, while the sign-in
 * door stays above them: on the way in the reader is answering "who am I", and only then is
 * "what is this account for" a question they can answer, whereas on the way back in that
 * same question is about the device this app is re-entering with ΓÇö which is why this half
 * keeps the compact segment and seeds itself from the device's own last answer.
 *
 * Each card carries the one sentence that says what that account is *for*, inside the card
 * rather than under the group, because under a group there is one slot and three answers ΓÇö
 * the line under the customer card would be about somebody else. The selection is said
 * three ways, as in `option-card`: the accent fill, the weight of the title and the tick,
 * and `accessibilityState.checked` for a reader who has none of them.
 *
 * The choice is disabled while the wait is open, the same rule as the form-switch button:
 * a type swapped mid-flight would change where the in-progress session is about to land.
 *
 * What this screen deliberately does **not** ask is which identity provider to use: that
 * is plumbing, not something a reader picking a role should adjudicate, so sign-in and
 * sign-up both go through the marketplace's own transport.
 *
 * ## The mark
 *
 * A glyph and the app's name, above the form, composed here from type and the existing
 * tokens. There is no logo asset in this app and this screen does not add one: a bundled
 * image would be a file to keep in a density per platform and a second thing that can
 * disagree with the palette, while the palette and the type scale are already the two things
 * every screen agrees with. The glyph is `storefront-outline` ΓÇö the storefront glyph this app
 * uses for the marketplace, so the lockup is the app's
 * own vocabulary rather than a new symbol ΓÇö drawn at `icon.action` in `colors.primary`. It
 * is hidden from the accessibility tree: the wordmark beside it is the name, and a glyph
 * with no label of its own is announced as nothing at all.
 *
 * The lockup cannot be `Screen`'s `title`. `Screen` renders its title strip before its
 * children, so nothing in the body can sit above it, and the strip is one string while this
 * is three nodes. So this screen asks for no `title` and composes the strip itself ΓÇö the
 * route `app/store/[slug].tsx` takes for the same reason ΓÇö which means paying the two
 * numbers the strip paid: `space.md` above it and `space.xs` between the title and its
 * subtitle (`components/screen.tsx:220-225`). The form title stays the loudest thing on the
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
 * The three keys the transport can produce are the three it names ΓÇö
 * `auth.error.invalidCredentials` for a 401, `auth.error.rateLimited` for a 429,
 * `auth.error.generic` for everything else (`packages/auth/src/marketplace-client.ts:30-40`)
 * ΓÇö and `authErrorKey` reduces the thrown message to that same set of three before it
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
 * is Android's alone ΓÇö RN declares it on `AccessibilityPropsAndroid` with `@platform android`
 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) ΓÇö so the slot
 * announces the sentence there, and iOS, which has no counterpart, gets it from
 * `AccessibilityInfo.announceForAccessibility` on the change that produced it. One platform
 * each and never both: a sentence a live region has already spoken is not read twice, it is
 * read as two sentences.
 *
 * ## The exit is not disabled while a request is out
 *
 * `fetch` in the transport takes no `AbortController` (`marketplace-client.ts:21-29`), so a
 * request that never answers is a wait with no timeout and nothing in this app can end it ΓÇö
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
 * `read()`, and `read()` never reports its own outcome ΓÇö a session read that came back with
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
/** The two assertions, tracked apart because they are two different claims. */
type ConsentName = "terms" | "age";
/**
 * What the new account is *for*, and the only three answers this platform has ΓÇö see
 * "The door is asked differently by each side". It is a distinct piece of state from
 * `role` on purpose: `role` is how this device enters with an account it already has,
 * and this is what account it is about to make.
 */
type RegistrationMode = "customer" | "business" | "delivery";

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
	/** The API's own sentence, or `null`. The refusal ΓÇö never the wait, and never "error". */
	const [failure, setFailure] = useState<string | null>(null);
	/**
	 * The API accepted the call. **Not** the same as a session, and the two are kept apart on
	 * purpose ΓÇö see "Success is the session's answer, not the call's" at the top of this file.
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
	// seeded from the device's own last answer, so a returning courier finds their role
	// selected.
	//
	// `AccountProfile`, not `"customer" | "delivery"`. It used to be the narrower pair,
	// which is the whole bug: a merchant who signed up as `business` and then signed
	// back in found no business on the rail, the `else` below wrote `"customer"` over
	// the stored preference, and the root resolver sent them to the storefront instead
	// of `/(business)`. The device already remembers all three and `lib/role.ts`
	// already resolves all three ΓÇö only this state refused to name one of them.
	const [role, setRole] = useState<AccountProfile>(() =>
		signingUp ? "customer" : getAccountProfile(),
	);
	// What a sign-up is *for*, asked in the cards below the fields. The setter is the
	// door's own ΓÇö see the docblock: this state being unwritable was exactly how every
	// registration silently became a customer. `business` is the seed, not `customer`:
	// the shop is the account this product exists for, and a form that opens on the
	// customer answer has already answered for the reader.
	const [registrationMode, setRegistrationMode] =
		useState<RegistrationMode>("business");
	const inFlight = useRef(false);

	/**
	 * The two sign-up assertions, held as their own state rather than folded into
	 * `problems`.
	 *
	 * They are not a field with an error but a control the reader has to operate, so
	 * they sit with the rest of the form's state and are read straight into the
	 * sign-up call. The Worker refuses a sign-up that arrives without both
	 * (`packages/trpc-api/src/auth.ts`, `databaseHooks.user.create.before`), which
	 * makes them mandatory rather than advisory ΓÇö so they are checked in `problems`
	 * too, to stop the round trip rather than to report a refusal after one.
	 */
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [ageConfirmed, setAgeConfirmed] = useState(false);

	// Derived, never stored: a second copy of "is this valid" is a second answer that can go
	// stale. The message is the dictionary's, and the check is the shape of what was typed.
	const problems = useMemo(() => {
		// Widened past `FieldName` because the two consent rows are reported the same
		// way a field is: the same reserved sentence, in the same slot, under the
		// control they belong to. Treating them as a different kind of thing is what
		// made the web form able to carry a checkbox the server never heard about.
		const found: Partial<Record<FieldName | ConsentName, string>> = {};

		if (signingUp && !name.trim()) found.name = t("form.required");

		if (!email.trim()) found.email = t("form.required");
		else if (!EMAIL_SHAPE.test(email.trim()))
			found.email = t("form.invalidEmail");

		if (!password) found.password = t("form.required");
		else if (signingUp && password.length < MIN_PASSWORD) {
			found.password = t("form.tooShort", { min: MIN_PASSWORD });
		}

		// Sign-up only. On sign-in these are already true of every account that can
		// exist, so asking again would be a control that could not change anything.
		if (signingUp && !termsAccepted)
			found.terms = t("auth.signUp.consentRequired");
		if (signingUp && !ageConfirmed)
			found.age = t("auth.signUp.consentRequired");

		return found;
	}, [ageConfirmed, email, name, password, signingUp, t, termsAccepted]);

	/**
	 * The sentence for `field`, but only once it is fair to show it.
	 *
	 * A text field earns its refusal on losing focus, because that is when the reader
	 * has stopped changing it. A checkbox has no such moment: it is either set or it
	 * is not, and the only fair time to complain is a submit that did nothing ΓÇö which
	 * is what `submitted` marks. So the two are read from different state on purpose,
	 * and indexing `blurred` with a consent key would be a type error that is really
	 * a design statement.
	 */
	const messageFor = (field: FieldName | ConsentName): string | null => {
		if (field in blurred) {
			return submitted || blurred[field as FieldName]
				? (problems[field] ?? null)
				: null;
		}
		return submitted ? (problems[field] ?? null) : null;
	};

	const leave = (field: FieldName) =>
		setBlurred((was) => ({ ...was, [field]: true }));

	/**
	 * What the reader types, and the one thing typing ends.
	 *
	 * Both halves of the last attempt's outcome go, not just the refusal: a sentence about
	 * values that have since changed is a sentence about nothing, and so is a recorded call
	 * whose session never arrived ΓÇö the reader is editing the credential that produced it.
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
		// on the same split as the failure sentence ΓÇö Android announces the slot's own word
		// through the live region when it mounts, and this would be that word again.
		if (Platform.OS === "ios") {
			AccessibilityInfo.announceForAccessibility(t("state.loading"));
		}

		try {
			// One transport, never chosen by the reader: which provider backs the
			// credential is plumbing, and a picker for it on this form was asking a
			// person picking a role to also adjudicate an infrastructure decision.
			const result = signingUp
				? await auth.signUp(email.trim(), password, name.trim(), {
						termsAccepted,
						ageConfirmed,
					})
				: await auth.signIn(email.trim(), password);

			if (result.ok) {
				// The selected profile is authoritative for this session. Persist the
				// customer choice too: writing only `delivery` left a previous courier
				// preference on the device, and the root resolver then sent a newly
				// registered customer to `/(delivery)` immediately after sign-up.
				//
				// All three answers are named on the sign-in path as well, for the same
				// reason. A merchant signing back in used to fall to the `"customer"`
				// else, which overwrote the stored `business` preference with the
				// storefront's ΓÇö so even the corrected navigation above would have been
				// undone the moment `lib/role.ts` read the device back on the next cold
				// start.
				await setAccountProfile(
					signingUp && registrationMode === "delivery"
						? "delivery"
						: signingUp && registrationMode === "business"
							? "business"
							: role === "delivery"
								? "delivery"
								: role === "business"
									? "business"
									: "customer",
				);
				// Recorded, not navigated from. The effect below navigates on the provider's
				// verified status; this handler only knows the call was accepted.
				setSent(true);
				return;
			}
			// The transport has already reduced the response to one of three keys ΓÇö a 401, a
			// 429, or everything else ΓÇö and this renders the key rather than inventing a
			// sentence. A rate limit reads "Demasiados intentos seguidos"; collapsing it into
			// "no pudimos entrar" would hide the one thing the reader can act on.
			setFailure(t(result.messageKey as MessageKey));
		} finally {
			// In `finally` because a throw on the way out must not leave the form permanently
			// busy ΓÇö a submit button that never comes back is a screen the customer has to
			// close the app to escape.
			inFlight.current = false;
			setPending(false);
		}
	}, [
		ageConfirmed,
		auth,
		email,
		name,
		password,
		problems,
		registrationMode,
		role,
		signingUp,
		t,
		termsAccepted,
	]);

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
	 * the round trip is over, the button is no longer busy, and the slot is empty ΓÇö a form
	 * that looks like it worked.
	 *
	 * It is the generic key, and that is the honest one: what reached us is a session read
	 * that came back with nothing, not a credential the API rejected at the door, so "Correo
	 * o contrase├▒a incorrectos" would name a cause nobody reported.
	 */
	const stranded = sent && !pending && auth.status === "signed-out";
	const message = failure ?? (stranded ? t("auth.error.generic") : null);

	/**
	 * Whether the wait is still open, and it outlives this form's own round trip.
	 *
	 * `pending` is this screen's call; the session read that must follow it belongs to the
	 * provider, so the slot keeps saying "CargandoΓÇª" until that has an answer too ΓÇö otherwise
	 * an accepted sign-in followed by a slow session read would show a form at rest with
	 * nothing in it, which is the same lie as an empty slot after a refusal.
	 */
	const waiting = pending || (sent && auth.status === "loading");

	useEffect(() => {
		// The destination, not always the root resolver: the identified courier goes straight to
		// the delivery tree ΓÇö which its own guard re-resolves from the preference this form just
		// wrote ΓÇö while everyone else lands at `/`, whose resolver is the one place that knows
		// the three trees.
		//
		// A merchant signing back in goes straight to `/(business)` for the same reason the
		// courier does. Falling through to `/` here was the visible half of the bug: the
		// preference was already being written as `"customer"`, so the root resolver would
		// have sent a shop owner to the storefront even if this branch had been left alone.
		if (sent && auth.status === "signed-in") {
			if (signingUp && registrationMode === "business") {
				router.replace("/new-business");
			} else if (signingUp && registrationMode === "delivery") {
				router.replace("/(delivery)/courier-profile");
			} else if (role === "delivery") {
				router.replace("/(delivery)");
			} else if (role === "business") {
				router.replace("/(business)");
			} else {
				router.replace("/");
			}
		}
	}, [auth.status, registrationMode, role, sent, signingUp]);

	/**
	 * iOS only, because the slot above is the whole of Android's announcement.
	 *
	 * `accessibilityLiveRegion` is declared on `AccessibilityPropsAndroid` with
	 * `@platform android` (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`),
	 * so Android says the sentence when the slot changes and iOS ΓÇö which ignores the prop ΓÇö
	 * has to be told. Announcing on both would say it twice on the platform that already
	 * spoke.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !message) return;
		AccessibilityInfo.announceForAccessibility(message);
	}, [message]);

	const title = signingUp
		? registrationMode === "business"
			? t("auth.signUp.business.title")
			: registrationMode === "delivery"
				? t("auth.signUp.delivery.title")
				: t("auth.signUp.title")
		: t("auth.signIn.title");
	const subtitle = signingUp
		? registrationMode === "business"
			? t("auth.signUp.business.subtitle")
			: registrationMode === "delivery"
				? t("auth.signUp.delivery.subtitle")
				: t("auth.signUp.subtitle")
		: t("auth.signIn.subtitle");

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

				{/* The door on the way back in ΓÇö see "The door is asked differently by each
				    side" above. Only sign-in asks it here: a sign-up asks the same question
				    as cards, below the fields. */}
				{!signingUp ? (
					<View style={styles.role}>
						<Segmented
							label={t("auth.role.label")}
							value={role}
							disabled={waiting}
							onChange={(next) =>
								setRole(
									next === "delivery"
										? "delivery"
										: next === "business"
											? "business"
											: "customer",
								)
							}
							options={[
								{ value: "customer", label: t("auth.role.customer") },
								{ value: "business", label: t("auth.role.business") },
								{ value: "delivery", label: t("auth.role.delivery") },
							]}
						/>
						{role === "delivery" ? (
							<Text variant="caption" tone="muted">
								{t("auth.role.deliveryHelp")}
							</Text>
						) : role === "business" ? (
							<Text variant="caption" tone="muted">
								{t("auth.role.businessHelp")}
							</Text>
						) : null}
					</View>
				) : null}

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

				{/*
					The two assertions, above the status slot and below the fields: the last
					thing a reader passes before the button they came to press.

					They are inside the form rather than inside `ActionBar` because they are
					not the screen's action ΓÇö the action is on the floor, and a bar that
					held a contract acceptance would be a bar holding two different kinds
					of control. The bar's docblock says it holds one action, and that still
					holds.

					`accessibilityRole="checkbox"` with `accessibilityState` is what makes
					VoiceOver and TalkBack announce the control as a checkbox rather than
					as a button that is pressed ΓÇö a reader who cannot see the tick still
					has to be able to ask what state it is in. The whole row is the target,
					not just the box, because the label is the larger part of it.
				*/}
				{signingUp ? (
					<View style={styles.consent}>
						<ConsentCheck
							label={t("auth.signUp.termsLabel")}
							link={t("auth.signUp.termsLink")}
							checked={termsAccepted}
							disabled={waiting}
							error={messageFor("terms")}
							onChange={setTermsAccepted}
						/>
						<ConsentCheck
							label={t("auth.signUp.ageLabel")}
							checked={ageConfirmed}
							disabled={waiting}
							error={messageFor("age")}
							onChange={setAgeConfirmed}
						/>
					</View>
				) : null}

				{/* The question the door above asks as a segment, asked here as cards and
				    asked last ΓÇö the reasons are in the docblock: the type is what the
				    account is *for*, and it reads as a promise only once the reader knows
				    who is filling this in. */}
				{signingUp ? (
					<AccountTypes
						value={registrationMode}
						disabled={waiting}
						onChange={setRegistrationMode}
					/>
				) : null}

				{/* One slot for both the failure and the wait, and it is reserved: the two controls
			    under it must not move when either appears. The word is the whole waiting state for
			    a reader who is not looking at the spinner. The failure comes first, because a
			    refusal is what the reader acts on and a wait is what they sit through.
			    The submit is not one of the two any more ΓÇö it is on the bar, which is outside this
			    scroll and moves for nothing the form does ΓÇö so what the reservation holds still is
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
					// deciding ΓÇö a fresh form has no `sent` of its own, and the reader would end up on
					// the sign-up screen signed in.
					disabled={waiting}
					onPress={() => router.replace(signingUp ? "/sign-in" : "/sign-up")}
				/>
				{/* Not disabled while the request is out. It is the way out of a wait this app cannot
			    bound ΓÇö nothing in the transport aborts a request ΓÇö and an exit closed from the
			    moment a tap is made until the network answers is a screen with no way off it. */}
				<BackButton to="/" />
			</Screen>

			{/* The screen's one action, on the floor rather than at the end of the form ΓÇö the reasons
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

/**
 * What the account is *for*: three cards, each carrying the promise that type makes.
 *
 * A group of choices, exactly as `components/option-card` is one, with one difference ΓÇö
 * these are the reader's three doors and each of them has a sentence to say, so the group
 * is a column of full-width rows rather than a rail of thumbnails: what distinguishes a
 * shop from a courier is that sentence, and a reader comparing three promises needs them
 * stacked where all three are visible at once.
 *
 * **The order is the funnel's** ΓÇö business first, then the customer, then the courier ΓÇö
 * because the shop is the account this product exists for and the customer is the
 * exception. The merchant is also the one every other language in the app writes first
 * (`auth.signUp.business.title` is the merchant's sign-up title, and `/new-business` is its
 * first screen), so the card that is selected on arrival is the one the rest of the form
 * is already shaped for.
 *
 * The titles are the sign-in door's own words (`auth.role.*`) and not a second set: the
 * same three types appear in both forms, and two dictionaries for them is two answers to
 * "what is a courier called" waiting to disagree. The one line under each is the type's
 * promise, and it is inside the card because under the group there is one slot and three
 * answers.
 *
 * The selection is drawn three ways ΓÇö fill, weight, tick ΓÇö and announced as
 * `accessibilityState.checked`, the same three-plus-one as `option-card` and for the same
 * reasons. The fill **settles** rather than snapping, as a crossfade between two painted
 * layers, and that is `step-progress`'s shape for its own fill and its own stated reason: a
 * colour is not a value reanimated interpolates cleanly across themes, while an opacity
 * between two layers is ΓÇö so this is also the one code path that survives a reduced-motion
 * request intact. The tick's pop is a transform, and that one is gated, exactly as
 * `option-card` gates its own.
 */
const ACCOUNT_TYPES = [
	{
		value: "business",
		glyph: "storefront-outline",
		title: "auth.role.business",
		help: "auth.signUp.type.businessHelp",
	},
	{
		value: "customer",
		glyph: "person-outline",
		title: "auth.role.customer",
		help: "auth.signUp.type.customerHelp",
	},
	{
		value: "delivery",
		glyph: "car-outline",
		title: "auth.role.delivery",
		help: "auth.signUp.type.deliveryHelp",
	},
] as const;

/**
 * What choosing a type changes, in the sentence the page's own subtitle would use.
 *
 * The group prints this under its heading, and the reason it is not the card's own promise
 * line is that the two answer different questions: the card says what that *type* can do,
 * this says what the *account* is about ΓÇö which is also what the title at the top of the
 * screen changes to. Without it, picking a courier changes a title that is off-screen at the
 * moment of choosing, so the consequence of the choice is somewhere the reader is not
 * looking; here it is printed next to the choice, and it is the same word for word, because
 * it is the same entry.
 *
 * A map rather than a sixth field on `ACCOUNT_TYPES`: the type's *name* and its *promise*
 * belong to the card, and this line is a fact about the mode rather than about the card ΓÇö
 * the title logic in the form above reads the same three keys for the same reason.
 */
const CONSEQUENCE: Record<RegistrationMode, MessageKey> = {
	business: "auth.signUp.business.subtitle",
	customer: "auth.signUp.customer.subtitle",
	delivery: "auth.signUp.delivery.subtitle",
};

function AccountTypes({
	value,
	disabled,
	onChange,
}: {
	value: RegistrationMode;
	disabled: boolean;
	onChange: (next: RegistrationMode) => void;
}) {
	const { t } = useT();

	return (
		<View style={styles.types}>
			<View style={styles.typesHead}>
				{/* `header` because this is a heading and a screen reader's rotor navigates by
				    heading ΓÇö and because the reader is about to walk three radios, and a group
				    that announces itself as three radios with nothing above them gives them no
				    question to answer. */}
				<Text variant="heading" accessibilityRole="header">
					{t("auth.signUp.typeLabel")}
				</Text>
				<Text variant="label" tone="muted">
					{t(CONSEQUENCE[value])}
				</Text>
			</View>

			{/* The role is on this box and not the outer one: `radiogroup` is a claim about
			    what is inside it, and two lines of prose are not options. */}
			<View style={styles.typeList} accessibilityRole="radiogroup">
				{ACCOUNT_TYPES.map((account) => (
					<TypeCard
						key={account.value}
						account={account}
						chosen={account.value === value}
						disabled={disabled}
						onPress={() => onChange(account.value)}
					/>
				))}
			</View>
		</View>
	);
}

/**
 * `space.huge + space.md` ΓÇö 44, the touch floor, built from spacing steps rather than typed.
 *
 * `./empty-state`'s badge is the same construction for the same reason: `theme/tokens.ts` has
 * no icon-badge size, and a bare number at a call site is how a design system grows a second
 * scale. Forty-four is also the right number here for a second reason ΓÇö the plate is inside
 * a row the reader aims at, so making it the minimum touch target costs the row nothing and
 * gives the glyph a square that is not smaller than the control it sits in.
 */
const PLATE = space.huge + space.md;

/**
 * One type, as a card: the promise it makes, and what choosing it does.
 *
 * Its own component rather than three copies inline in `AccountTypes` because the animation
 * is three shared values and a hook is not allowed inside a `.map` callback ΓÇö and because
 * this is `option-card`'s shape exactly (a row per choice, one at a time, each with its own
 * state), which is the argument for not inventing a second version of the same control.
 */
function TypeCard({
	account,
	chosen,
	disabled,
	onPress,
}: {
	account: (typeof ACCOUNT_TYPES)[number];
	chosen: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const reduceMotion = useReducedMotion();

	// The fill, as a crossfade between two painted layers rather than an animated colour:
	// `step-progress` says why, and the two overlays below are its construction.
	const fill = useSharedValue(chosen ? 1 : 0);
	// The tick's pop, seeded with the state the card mounted at ΓÇö so the card that arrives
	// chosen does not pop on the way in, which is `option-card`'s second of its three rules.
	const scale = useSharedValue(1);
	const shown = useRef(chosen);

	useEffect(() => {
		fill.value = withTiming(chosen ? 1 : 0, { duration: duration.standard });
	}, [chosen, fill]);

	useEffect(() => {
		if (reduceMotion) {
			shown.current = chosen;
			cancelAnimation(scale);
			scale.value = 1;
			return;
		}
		if (shown.current === chosen) return;
		shown.current = chosen;
		scale.value = withSequence(
			withTiming(STATE_POP, { duration: duration.instant }),
			withSpring(1, spring.press),
		);
	}, [chosen, reduceMotion, scale]);

	const settle = useAnimatedStyle(() => ({ opacity: fill.value }));
	const pop = useAnimatedStyle(() => ({
		transform: [{ scale: reduceMotion ? 1 : scale.value }],
	}));

	return (
		<Pressable
			onPress={() => {
				// The same tick the option rail gives a choice, so a hand that has already
				// learned "this felt like this" is not taught again here.
				selection();
				onPress();
			}}
			disabled={disabled}
			accessibilityRole="radio"
			// No `accessibilityLabel`: the card's own title and promise are the label, and a
			// card that overrides it stops reading the promise ΓÇö which is the half that says
			// what picking this one means.
			accessibilityState={{ checked: chosen, disabled }}
			style={[
				styles.type,
				{
					// `input` and not `border`, and this is the token file's own argument rather
					// than a preference: `border` is the decorative hairline (1.34:1 on `card`),
					// `input` is "the boundary that tells a reader where a control begins"
					// (3.24:1). This row is a control and its edge is the only thing saying so
					// before it is touched, so it is owed the 3:1 and not the rumour.
					backgroundColor: colors.card,
					borderColor: colors.input,
				},
			]}
		>
			{/* The two overlays, absolute and inert: the fill and the chosen edge. Neither can
			    move the text or shrink the hit box, so the card's layout is the same whichever
			    type is selected ΓÇö which is the point of a crossfade here rather than a colour
			    swap. */}
			<Animated.View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					styles.typeFill,
					// `accent` and not `primary`, as in `option-card`: three filled cards in the
					// colour of the submit button would read as three submit buttons, and this
					// screen has one action on the floor.
					{ backgroundColor: colors.accent },
					settle,
				]}
			/>
			<Animated.View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					styles.typeFill,
					{ borderWidth: 1, borderColor: colors.primary },
					settle,
				]}
			/>

			<View
				style={[
					styles.typeGlyph,
					{
						// The plate inverts with the card rather than staying `muted`: on an
						// accent fill a muted plate is a hole.
						backgroundColor: chosen ? colors.card : colors.muted,
					},
				]}
			>
				<Ionicons
					name={account.glyph}
					size={icon.action}
					color={chosen ? colors.primary : colors.mutedForeground}
					accessibilityElementsHidden
					importantForAccessibility="no"
				/>
			</View>

			<View style={styles.typeBody}>
				<Text variant="body" bold={chosen}>
					{t(account.title)}
				</Text>
				{/* `label` and not `caption`: 12 is this app's smallest text and this is a
				    sentence the reader is being asked to choose by, not a caption on the choice.
				    `option-card`'s own two lines are `body` and `label`, and matching them is
				    what makes the two "choose one" surfaces in this app read as one system. */}
				<Text variant="label" tone="muted">
					{t(account.help)}
				</Text>
			</View>

			{chosen ? (
				<Animated.View style={pop}>
					<Ionicons
						name="checkmark"
						size={icon.control}
						color={colors.primary}
						// The radio's own state is announced; an image read after it repeats it.
						accessibilityElementsHidden
						importantForAccessibility="no"
					/>
				</Animated.View>
			) : null}
		</Pressable>
	);
}

/**
 * One assertion: a tick, the sentence, and the reserved line the refusal appears on.
 *
 * The three parts are one target. Tapping the sentence has to count, because the
 * sentence is most of the control's width and a reader aiming at the words they are
 * reading should not miss; a box 20 points wide is a target that punishes a large
 * thumb for being imprecise.
 *
 * `Pressable` rather than `Button` because this is not an action that happens ΓÇö it is
 * a state the reader sets, and it stays where it is with its answer visible, which is
 * what `accessibilityRole="checkbox"` tells the screen reader it is.
 *
 * The error line is reserved at the label's own line height for the same reason
 * `Field` reserves its own: a sentence appearing under an unchecked box must not push
 * the box the reader is reaching for. Both boxes hold their position whether or not
 * either is answered.
 */
function ConsentCheck({
	label,
	link,
	checked,
	disabled,
	error,
	onChange,
}: {
	label: string;
	/** Optional trailing affordance. Present only on the terms row. */
	link?: string;
	checked: boolean;
	disabled: boolean;
	error: string | null;
	onChange: (next: boolean) => void;
}) {
	const { colors } = useTheme();
	return (
		<View style={styles.consentRow}>
			<Pressable
				accessibilityRole="checkbox"
				accessibilityState={{ checked, disabled }}
				accessibilityLabel={label}
				disabled={disabled}
				onPress={() => onChange(!checked)}
				// A row whose edges are the form's edges, so it takes the row scale
				// rather than the button one ΓÇö see `components/pressable.tsx`.
				scaleTo={PRESS_SCALE_ROW}
				// `disabledOpacity={1}` because this control is *unavailable*, not busy:
				// the shared default would fade the label toward the background, and
				// the label is the thing that says what is being agreed to.
				disabledOpacity={1}
				style={[styles.consentTarget, disabled ? { opacity: 0.5 } : null]}
			>
				<Ionicons
					name={checked ? "checkbox" : "square-outline"}
					size={icon.action}
					color={checked ? colors.primary : colors.mutedForeground}
				/>
				<Text variant="caption" tone="muted" style={styles.consentLabel}>
					{label}
					{link ? (
						<Text variant="caption" tone="action" style={styles.consentLink}>
							{" "}
							{link}
						</Text>
					) : null}
				</Text>
			</Pressable>
			{error ? (
				<Text
					variant="caption"
					tone="destructive"
					accessibilityLiveRegion="polite"
				>
					{error}
				</Text>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	// and the bar is its footer, which is the arrangement `app/profile.tsx` uses for the same
	// pair. A bar outside a `flex: 1` column is a bar with no height to sit under.
	root: { flex: 1 },
	content: { gap: space.lg, paddingTop: space.md },
	identity: { gap: space.md },
	mark: { flexDirection: "row", alignItems: "center", gap: space.sm },
	// `Screen`'s strip put this between the title and its subtitle
	// (`components/screen.tsx:220-225`); the strip is composed here now, so the number is
	// paid here.
	subtitle: { marginTop: space.xs },
	// The identification group and its one help line, kept together: the line is the
	// delivery choice's own sentence and must not float free of the control that chose it.
	role: { gap: space.xs },
	// The two assertions as one block, so they read as the pair they are rather
	// than as two unrelated controls that happen to sit near each other.
	consent: { gap: space.sm },
	consentRow: { gap: space.xs },
	// The whole row is the target ΓÇö see `ConsentCheck`.
	consentTarget: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
		paddingVertical: space.xs,
	},
	consentLabel: { flex: 1 },
	consentLink: { textDecorationLine: "underline" },
	// The sign-up door, below the fields: the heading is a peer of the field labels
	// (`Field`'s own, not smaller) so the group reads as the last question of the form
	// rather than as a caption on the password.
	types: { gap: space.md },
	// The heading and the line that says what the chosen type changes, at the gap the page's
	// own title strip uses between a title and its subtitle ΓÇö the two are the same pair of
	// lines, and the group is not a second strip with a different rhythm.
	typesHead: { gap: space.xs },
	// Cards 8 apart rather than 12: this is a set of one choice, and the tighter rhythm is
	// what reads as "these three are alternatives" rather than "these are three sections".
	typeList: { gap: space.sm },
	// A full-width row, not a card in a column of its own: the line beside the title is the
	// promise, and it needs the width. `minHeight` is a floor - at 200% Dynamic Type both
	// lines grow past it and the row grows with them rather than clipping them.
	type: {
		flexDirection: "row",
		alignItems: "center",
		gap: space.md,
		padding: space.md,
		borderRadius: radius.md,
		borderWidth: 1,
		minHeight: MIN_TOUCH_TARGET,
	},
	// The two overlays and the card's own corner, in one rule: an overlay without the corner
	// would square off the row's `radius.md` at whichever end the fill is settling toward.
	typeFill: { borderRadius: radius.md },
	typeGlyph: {
		alignItems: "center",
		justifyContent: "center",
		width: PLATE,
		height: PLATE,
		// `radius.full` and not the row's own corner: a rounded plate inside a row carrying
		// the same radius reads as one shape that was drawn twice, and a circle is what
		// `./empty-state`'s badge is for a glyph of this size.
		borderRadius: radius.full,
	},
	typeBody: { flex: 1, gap: TEXT_STACK_GAP },
	// `minHeight` is a floor: at 200% Dynamic Type the sentence and the word both grow past
	// it, and the slot grows with them instead of clipping them.
	status: { minHeight: typeScale.body.lineHeight, justifyContent: "center" },
});

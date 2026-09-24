import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";

import { ActionBar } from "@/components/action-bar";
import { AnimateIn } from "@/components/animate-in";
import { Field } from "@/components/field";
import { Screen } from "@/components/screen";
import { SignedIn } from "@/components/signed-in";
import { Text } from "@/components/text";
import { useToast } from "@/components/toast";
import { marketplaceAuth } from "@/lib/auth/client";
import { authErrorKey, useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { space, type } from "@/theme";

/**
 * Set a new password, proving the current one.
 *
 * Better Auth's `/change-password` does the checking (`packages/auth`); this
 * screen states the rules before the round trip — twelve characters minimum,
 * the two new fields agreeing — because a refusal that only names "could not"
 * tells the reader nothing they can act on. A wrong current password arrives
 * as the transport's generic key, which is the honest limit of what the
 * screen knows: the server does not say which half was wrong.
 *
 * The save bar is a sibling of `Screen`, exactly as `app/profile.tsx` lays
 * out: the bar pays its own bottom inset and the frame scrolls above it.
 */
export default function ChangePassword() {
	const { t } = useT();
	const { status } = useSession();
	const toast = useToast();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [blurred, setBlurred] = useState({ next: false, confirm: false });
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const inFlight = useRef(false);

	const problems = {
		next:
			next.length > 0 && next.length < MIN_PASSWORD_LENGTH
				? t("auth.error.weakPassword")
				: null,
		confirm:
			confirm.length > 0 && confirm !== next
				? t("auth.error.passwordsDiffer")
				: null,
	};
	const messageFor = (field: "next" | "confirm"): string | null =>
		submitted || blurred[field] ? (problems[field] ?? null) : null;

	/**
	 * The refusal, read out on iOS, where nothing else will read it.
	 *
	 * `accessibilityLiveRegion` is Android's and Android's alone — RN declares it on
	 * `AccessibilityPropsAndroid` with `@platform android`
	 * (`types_generated/Libraries/Components/View/ViewAccessibility.d.ts:108-110`) — so the
	 * assertion on the status line below is the whole of Android's announcement of this
	 * sentence, and iOS, which ignores the prop, has to be told. Guarded by the platform rather
	 * than announced on both: a sentence a live region has already spoken is not read twice, it
	 * is read as two sentences. It fires on the sentence changing, which is the moment a
	 * refused save reached the screen, and not on the keystroke that clears it — `setFailure`
	 * is called with `null` before the next attempt, and a null announces nothing.
	 */
	useEffect(() => {
		if (Platform.OS !== "ios" || !failure) return;
		AccessibilityInfo.announceForAccessibility(failure);
	}, [failure]);

	const submit = useCallback(() => {
		if (inFlight.current) return;
		setSubmitted(true);
		if (
			!current.trim() ||
			next.length < MIN_PASSWORD_LENGTH ||
			next !== confirm
		)
			return;
		inFlight.current = true;
		setSaving(true);
		setFailure(null);
		void marketplaceAuth
			.changePassword(current, next)
			.then(() => {
				toast.show(t("account.password.saved"));
				leaveScreen("/settings");
			})
			.catch((error: unknown) => {
				setFailure(
					t(authErrorKey(error instanceof Error ? error.message : "")),
				);
			})
			.finally(() => {
				inFlight.current = false;
				setSaving(false);
			});
	}, [current, next, confirm, t, toast]);

	const edited = (apply: () => void) => {
		apply();
		setFailure(null);
	};

	return (
		<View style={styles.root}>
			<Screen
				title={t("account.password.title")}
				scroll
				keyboardInsets
				contentStyle={styles.content}
			>
				<SignedIn>
					<AnimateIn index={0}>
						<Field
							label={t("auth.field.currentPassword")}
							value={current}
							onChangeText={(value) => edited(() => setCurrent(value))}
							secureTextEntry
							autoComplete="current-password"
						/>
					</AnimateIn>
					<AnimateIn index={1}>
						<Field
							label={t("auth.field.password")}
							value={next}
							onChangeText={(value) => edited(() => setNext(value))}
							onBlur={() => setBlurred((was) => ({ ...was, next: true }))}
							error={messageFor("next")}
							secureTextEntry
							autoComplete="new-password"
							help={t("auth.field.password.placeholder")}
						/>
					</AnimateIn>
					<AnimateIn index={2}>
						<Field
							label={t("auth.field.confirmPassword")}
							value={confirm}
							onChangeText={(value) => edited(() => setConfirm(value))}
							onBlur={() => setBlurred((was) => ({ ...was, confirm: true }))}
							error={messageFor("confirm")}
							secureTextEntry
							autoComplete="new-password"
						/>
					</AnimateIn>

					{/* Reserved, as on the profile form: the refusal sits in a line
					    that holds its height whether or not there is anything in
					    it, so the form never reflows around a failure. The
					    confirmation is the toast, once. */}
					<AnimateIn index={3}>
						<View style={styles.status}>
							{failure ? (
								<Text
									variant="body"
									tone="destructive"
									accessibilityRole="alert"
									accessibilityLiveRegion="assertive"
								>
									{failure}
								</Text>
							) : null}
						</View>
					</AnimateIn>
				</SignedIn>
			</Screen>

			{/* Drawn only when the form it saves is on screen. A "Guardar" over
			    a spinner or the signed-out sentence is a control for something
			    that is not there. */}
			{status === "signed-in" ? (
				<ActionBar
					docked
					primary={{
						label: t("action.save"),
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
 * Better Auth's floor (`apps/api/src/auth.ts`), restated rather than
 * re-decided — copy that disagreed with the server would be the form lying
 * about the one requirement it enforces.
 */
const MIN_PASSWORD_LENGTH = 12;

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: { gap: space.lg },
	status: { minHeight: type.body.lineHeight, justifyContent: "center" },
});

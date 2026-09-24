import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";

import { useApiFailure } from "@/lib/api-error";
import { icon, radius, space, type, useTheme } from "@/theme";

import { Text } from "./text";

/**
 * What the API said, when an optimistic change was refused.
 *
 * `docs/design-mobile.md` asks for two things when a write is rolled back: the change is
 * undone, *and* the customer is told why in the API's own sentence. This is the second
 * half. The sentence is not re-written here and not summarised into "no se pudo
 * actualizar": the API's refusals are specific and already written in Spanish for a
 * customer — "Tu carrito está lleno", "Una de las opciones ya no está disponible" — and a
 * generic line in front of them would be this file inventing a worse version of a
 * sentence somebody already wrote.
 *
 * ## Which sentences are the API's, and which are ours
 *
 * A 4xx message is the API talking to the customer: it was written deliberately, it says
 * something they can act on, and it is the truthful account of what happened. A 5xx
 * message, or a failure with no status at all (a dropped connection, a rejected fetch),
 * is a log line — "Internal server error", "Failed to fetch" — and those are ours to
 * replace with `state.error.body`. The rule is the status code, because it is the one
 * field that tells the two apart without parsing prose.
 *
 * ## The haptic is not here
 *
 * `warning()` is fired by the mutation that failed, at the moment it fails. A component
 * that buzzes on mount would buzz again on every re-render that remounted it, and a
 * haptic that arrives from a render path is a haptic nobody can reason about.
 *
 * The announcement is here, though, for the same reason the sentence is: this is the
 * component that knows when the sentence reached the screen. `accessibilityRole="alert"`
 * covers Android's live region; iOS announces nothing for a role alone, so the sentence
 * is read out explicitly on the change that produced it.
 *
 * ## iOS is the only platform the explicit call is for, and `Platform.OS` is what says so
 *
 * The two mechanisms are alternatives, not layers. Android reads the live region and speaks
 * the sentence when the view appears; calling `announceForAccessibility` as well speaks the
 * same sentence a second time, because TalkBack has already announced it once. The gate below
 * is therefore part of the rule above rather than a platform tweak — the sentence must be
 * announced exactly once per appearance on each platform, and only one of the two mechanisms
 * exists on each.
 *
 * `components/toast.tsx:201` carries the identical gate for the identical reason. Two files
 * that both announce a transient sentence is exactly the pair where one of them drifts, so the
 * pattern is worth naming here: **on Android, the live region announces; on iOS, the explicit
 * call does.** A comment that claims this and a `useEffect` that does it unconditionally is the
 * shape this defect had — the prose was right and the code was not.
 */
export function RollbackNotice({ error }: { error: unknown }) {
	const { colors } = useTheme();
	const { failure, message } = useApiFailure(error);

	const deliberate =
		failure.httpStatus !== null &&
		failure.httpStatus < 500 &&
		failure.serverMessage.length > 0;
	const sentence = deliberate ? failure.serverMessage : message;

	useEffect(() => {
		if (!sentence || Platform.OS !== "ios") return;
		AccessibilityInfo.announceForAccessibility(sentence);
	}, [sentence]);

	if (!error || !sentence) return null;

	return (
		<View
			style={[
				styles.notice,
				{ backgroundColor: colors.card, borderColor: colors.destructive },
			]}
			accessibilityRole="alert"
			accessibilityLiveRegion="polite"
		>
			<Ionicons
				name="alert-circle-outline"
				// `icon.inline` — "a mark on a line of text that is not itself a target", which is
				// what this glyph is: hidden from the tree, sitting on the first line of a `body`
				// sentence. It was `type.heading.fontSize`, a type step borrowed as an icon size,
				// and there is no heading in this block for it to match. `./toast` draws the
				// identical row — same flex, same `alignItems`, same one body sentence — at
				// `icon.inline`.
				size={icon.inline}
				color={colors.destructive}
				accessibilityElementsHidden
				importantForAccessibility="no"
			/>
			<Text variant="body" tone="destructive" style={styles.sentence}>
				{sentence}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	notice: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: space.sm,
		borderWidth: 1,
		// `radius.md`, the step for a surface — `sm` is the control step, and nothing presses this
		// block. It is the same block as `./toast`: `colors.card`, a hairline, one sentence over
		// the page. The corner was the only place the two disagreed.
		borderRadius: radius.md,
		padding: space.md,
		// A message that wraps to three lines at 200% Dynamic Type pushes the icon to the
		// top of the block; the icon's own line height keeps it beside the first one.
		minHeight: type.body.lineHeight,
	},
	sentence: { flex: 1 },
});

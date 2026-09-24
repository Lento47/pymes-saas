/**
 * Haptics, by meaning rather than by mechanism.
 *
 * `docs/design-mobile.md` gives four haptics and says what each one *means*: `selection`
 * when a tab, segment or picker settles; `light` on add-to-cart, favourite or quantity;
 * `success` when an order is placed; `warning` on a destructive confirm or a failed
 * optimistic write. Those four names are the whole vocabulary, and a screen calls them —
 * never `expo-haptics` directly.
 *
 * The reason is that a raw call site reads as a mechanism, not a message: `impactAsync(
 * ImpactFeedbackStyle.Medium)` says nothing about why, so the next person changes the
 * style to "make it feel better" and the vocabulary dissolves. There is also a rule
 * attached to each one — never on scroll, never on render, never to pull attention at
 * something the reader did not ask for — and that rule is easier to keep when the four
 * permitted reasons have names.
 *
 * ## Two guarantees every wrapper makes
 *
 * 1. **It never throws.** The native module is absent on a simulator and on an Expo Go
 *    build that lacks the plugin, and `expo-haptics` reports that by rejecting a promise
 *    or by throwing an `UnavailabilityError`. A missing buzz is not a reason to take a
 *    screen down, so both are swallowed here.
 * 2. **It is a no-op where there is nothing to buzz with.** A browser has no taptic
 *    engine and neither does an iPad, and the honest thing is to do nothing rather than
 *    to call into a generator that silently discards the request.
 *
 * A haptic is never the only signal. A phone on silent is a phone where this module does
 * not exist, so every one of these calls has a visual twin — the state change itself —
 * and that twin is what the reader is actually being told.
 */

import * as ExpoHaptics from "expo-haptics";
import { Platform } from "react-native";

import { areHapticsEnabled } from "@/lib/device-prefs";

/**
 * Whether this device has anything to buzz with.
 *
 * Web is checked because `expo-haptics` ships a web module that resolves and does nothing,
 * and an iPad because its `UIFeedbackGenerator` calls are accepted and discarded — the
 * engine is not there. Android is allowed through: it is a vibrator rather than a taptic
 * engine, `expo-haptics` degrades to a no-op on a device without one, and refusing to
 * answer on the platform the shop's own phone runs would be the wrong reading of the rule.
 */
function hasTapticEngine(): boolean {
	if (Platform.OS === "web") return false;
	if (Platform.OS === "ios" && Platform.isPad) return false;
	return true;
}

/**
 * Run one haptic, swallowing every way it can fail.
 *
 * The customer's own switch comes first: `settings.haptics` off means none of
 * the four below run at all. The visual twin carries the meaning on its own —
 * the module's docblock says a haptic is never the only signal — so silence is
 * a complete answer rather than a missing one.
 *
 * The `try` is not redundant beside the `catch`: `expo-haptics`' exported functions are
 * `async`, so their failure arrives as a rejected promise, but reanimated worklets and
 * synchronous module lookups can throw where they are called. Both are silent, and a
 * floating rejection is the one that shows up as a red box in development.
 */
function fire(run: () => Promise<void>): void {
	if (!areHapticsEnabled()) return;
	if (!hasTapticEngine()) return;
	try {
		void run().catch(() => {});
	} catch {
		// Nothing to do and nothing to say: a haptic that did not happen is not an error.
	}
}

/** A tab, segment or picker settling on a value. */
export function selection(): void {
	fire(() => ExpoHaptics.selectionAsync());
}

/** Add-to-cart, favourite, a quantity step — a change the reader made on purpose. */
export function light(): void {
	fire(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light));
}

/** An order placed. The one commit in the app that gets an unmistakable answer. */
export function success(): void {
	fire(() =>
		ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success),
	);
}

/** A destructive confirm, or an optimistic write the API refused and rolled back. */
export function warning(): void {
	fire(() =>
		ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning),
	);
}

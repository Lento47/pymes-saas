/**
 * The new-order chime, interface.md §57 — by meaning rather than by mechanism, the rule
 * `./haptics.ts` writes for its own four names.
 *
 * §57 asks for something "distinctive / short / ~400–700ms" and says the critical order
 * alert "should not sound like a casual push notification". A push is a soft blip that
 * could be anything; this is `assets/sounds/new-order.wav`, two struck bell notes a fourth
 * apart (E5 → A5), 620ms, the shape of a counter bell saying work arrived. A merchant on a
 * phone in a service window does not miss that one.
 *
 * ## One name, one reason, one call site
 *
 * The module exports exactly one function and it is called from exactly one place — the
 * board's arrival effect in `app/(business)/business.tsx`, beside `./new-order-banner`'s
 * `show()`. §57's "not reused for ordinary notifications" is a rule about *call sites*, not
 * about the file: the second caller is the moment this becomes the app's generic notification
 * sound and stops meaning "an order". `lib/haptics.ts` names its four for the same reason.
 *
 * ## Two guarantees every wrapper makes
 *
 * 1. **It never throws.** The native module is absent in Expo Go without the plugin, the
 *    asset can fail to resolve, and `createAudioPlayer` reports both by throwing or by
 *    rejecting. A silent chime is not a reason to take the board down — the banner beside
 *    it is already saying the same thing out loud — so every path is swallowed here.
 * 2. **It is a no-op where there is nothing to play with.** `isBoardSoundEnabled()` off is
 *    the merchant's own answer and it comes first; web is checked for the reason
 *    `./haptics.ts` checks it (there is no board there to raise this); and a player that
 *    cannot be built is silence rather than a red box.
 *
 * A chime is never the only signal. §24's banner is the twin this always has, and the board
 * row is the twin behind that — so the merchant's switch off, the phone on silent, or a
 * build without `expo-audio` all end at the same complete answer rather than a missing one.
 *
 * ## The repeat rule is restart, not stack
 *
 * §57 asks for "repeat rules controlled", and the arrival detector already fires once per
 * order id. What is left is the case the detector cannot see: two orders inside one 620ms
 * ring. Two bells over each other is a jingle, so the second call restarts the chime from
 * its first note instead — the same "a replacement mid-flight continues from wherever it is"
 * idea `./new-order-banner` and `./toast` both run, expressed as sound.
 *
 * ## OS modes, and why `playsInSilentMode` is false
 *
 * §57's "respect OS modes where appropriate". `playsInSilentMode: false` is the whole of it:
 * on iOS the silent switch suppresses this, and on Android the plugin's own docs say playback
 * is suppressed when the ringer mode is silent or vibrate. A merchant who has silenced the
 * phone has said what they want, and a chime that overrides that is the thing §57 is warning
 * about turned inside out.
 *
 * `interruptionMode: "mixWithOthers"` is the other half. The counter may well have music
 * going, and `expo-audio`'s own docs name this mode for "sound effects, UI feedback, or
 * short audio clips" — exactly a 620ms chime. `doNotMix` would cut the music for a bell.
 *
 * `shouldPlayInBackground: false` matches `app.config.ts`'s `enableBackgroundPlayback: false`:
 * the chime is foreground news, and declaring a background audio mode for it would be a
 * capability the app does not use — the same rule that stripped the microphone out of it.
 */

import {
	type AudioPlayer,
	createAudioPlayer,
	setAudioModeAsync,
} from "expo-audio";
import { Platform } from "react-native";
import { isBoardSoundEnabled } from "@/lib/device-prefs";
import chime from "../assets/sounds/new-order.wav";

/**
 * The one player, built on first use and kept for the app's life.
 *
 * `createAudioPlayer` is documented as the variant that "doesn't release automatically",
 * which is what a singleton wants: building a player per arrival would allocate a native
 * object every few minutes and leak one per order. It is a `let` and not a module-level
 * call because a throw at import time would take the whole bundle down on a platform that
 * cannot build one — see the file docblock's first guarantee.
 */
let player: AudioPlayer | null = null;

/** Set once, the first time a chime is asked for. Never re-set: the mode does not move. */
let modeReady = false;

/**
 * Build the player, or answer `null` when this build cannot.
 *
 * A `try` around the whole thing rather than a check for the native module: `expo-audio`
 * resolves on every platform and the failure arrives as a throw from the constructor on
 * the ones without it, and a null here is the signal the caller already knows how to read.
 */
function ensurePlayer(): AudioPlayer | null {
	if (player) return player;
	try {
		player = createAudioPlayer(chime);
		return player;
	} catch {
		return null;
	}
}

/**
 * Put the playback session in the mode §57 asks for, once.
 *
 * The flag is set before the await and not after on purpose: two arrivals inside one tick
 * would otherwise both call `setAudioModeAsync`, and the second is a redundant native round
 * trip for a mode that does not change. A rejection is swallowed the same way — the chime
 * still plays, it just plays on whatever session the phone already had.
 */
async function ensureMode(): Promise<void> {
	if (modeReady) return;
	modeReady = true;
	try {
		await setAudioModeAsync({
			playsInSilentMode: false,
			interruptionMode: "mixWithOthers",
			shouldPlayInBackground: false,
		});
	} catch {
		// Silence, and no retry: the mode is an improvement and not a precondition.
	}
}

async function ring(): Promise<void> {
	await ensureMode();
	const one = ensurePlayer();
	if (!one) return;
	// Restart rather than stack — see the file docblock. `pause` first so the tail of the
	// previous ring is not still sounding under the new one, then rewind, then play.
	if (one.playing) one.pause();
	await one.seekTo(0);
	one.play();
}

/**
 * Ring the new-order chime. The board calls this when a poll lands a new order.
 *
 * Fire-and-forget, like `./haptics.ts`'s four: the arrival effect is a render-phase
 * companion and must not await anything, and a rejection here is silence rather than an
 * error. The `try` around the call is the same belt to the same braces `fire()` wears.
 */
export function newOrderSound(): void {
	if (!isBoardSoundEnabled()) return;
	if (Platform.OS === "web") return;
	try {
		void ring().catch(() => {});
	} catch {
		// Nothing to do and nothing to say: a chime that did not happen is not an error.
	}
}

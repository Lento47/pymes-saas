import { useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";

// One OS subscription for every animated control. Reanimated's hook captures
// startup state; this store also follows changes made while the app is open.
//
// `reduced` starts pessimistic — a reader who asked for less movement gets less
// movement even if the query never comes back — but that makes it a *guess*, not
// an answer, and `resolved` is what tells the two apart. Anything that plays a
// one-shot timeline has to wait for it: a guess that arrives first and is
// corrected a frame later is a component that restarts its animation in front of
// the reader, which is the one thing a launch animation must not do.
let reduced = true;
let resolved = false;
let revision = 0;
const listeners = new Set<() => void>();
let cleanup: (() => void) | undefined;

function publish(value: boolean) {
	const changed = !resolved || value !== reduced;
	reduced = value;
	resolved = true;
	if (!changed) return;
	for (const listener of listeners) listener();
}

function refresh() {
	const request = ++revision;
	void AccessibilityInfo.isReduceMotionEnabled()
		.then((value) => {
			if (request === revision) publish(value);
		})
		.catch(() => {
			// Keep the last answer, but stop waiting: the fallback is final now, and a
			// caller blocked on `resolved` would otherwise never run at all.
			if (request === revision) publish(reduced);
		});
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (listeners.size === 1) {
		const motion = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			(value) => {
				++revision;
				publish(value);
			},
		);
		const app = AppState.addEventListener("change", (state) => {
			if (state === "active") refresh();
		});
		cleanup = () => {
			motion.remove();
			app.remove();
			++revision;
		};
		refresh();
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			cleanup?.();
			cleanup = undefined;
		}
	};
}

const getSnapshot = () => reduced;
const getServerSnapshot = () => true;
const getResolvedSnapshot = () => resolved;
const getServerResolvedSnapshot = () => false;

export function useReducedMotion() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Whether the OS has actually answered yet.
 *
 * For a control whose motion is a *response* to a finger, the pessimistic
 * fallback is the right thing to read: it is only ever a frame or two out, and
 * getting it briefly wrong costs nothing. For anything that plays once on
 * purpose — an entrance, a hand-off — reading the fallback is a bug, because the
 * real answer then arrives and restarts the timeline under the reader. Such a
 * component gates on this instead, and starts exactly once, in the right mode.
 */
export function useReducedMotionResolved() {
	return useSyncExternalStore(
		subscribe,
		getResolvedSnapshot,
		getServerResolvedSnapshot,
	);
}

import { useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState } from "react-native";

// One OS subscription for every animated control. Reanimated's hook captures
// startup state; this store also follows changes made while the app is open.
let reduced = true;
let revision = 0;
const listeners = new Set<() => void>();
let cleanup: (() => void) | undefined;

function publish(value: boolean) {
	if (value === reduced) return;
	reduced = value;
	for (const listener of listeners) listener();
}

function refresh() {
	const request = ++revision;
	void AccessibilityInfo.isReduceMotionEnabled()
		.then((value) => {
			if (request === revision) publish(value);
		})
		.catch(() => {
			// Keep the last answer; the initial fallback avoids unexpected movement.
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

export function useReducedMotion() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

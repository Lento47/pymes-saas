import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
} from "react-native";
import { duration } from "./motion";
import { useReducedMotion } from "./reduced-motion";
import {
	COMPACT_CAPSULE_SCALE,
	compactCapsuleAt,
	createTabScrollState,
} from "./tab-scroll-state";

const scrollState = createTabScrollState();

/** Attach to the screen's vertical scroller, never to horizontal shelves or sheets. */
export function useTabScroll(enabled = true) {
	const source = useRef(Symbol("tab-scroll"));
	const compact = useRef(false);
	useFocusEffect(
		useCallback(() => {
			if (!enabled) return;
			scrollState.activate(source.current, compact.current);
			return () => scrollState.deactivate(source.current);
		}, [enabled]),
	);
	return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const next = compactCapsuleAt(
			event.nativeEvent.contentOffset.y,
			compact.current,
		);
		if (next === compact.current) return;
		compact.current = next;
		scrollState.update(source.current, next);
	}, []);
}

/** Animate the navigator's native Animated.View without rendering on scroll frames. */
export function useCapsuleScrollScale(fontScale: number) {
	const scale = useRef(new Animated.Value(1)).current;
	const reduceMotion = useReducedMotion();
	useEffect(() => {
		const allowed = !reduceMotion && fontScale <= 1.3;
		const update = () => {
			scale.stopAnimation();
			if (!allowed) {
				scale.setValue(1);
				return;
			}
			Animated.timing(scale, {
				toValue: scrollState.getSnapshot() ? COMPACT_CAPSULE_SCALE : 1,
				duration: duration.standard,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
				isInteraction: false,
			}).start();
		};
		update();
		const unsubscribe = scrollState.subscribe(update);
		return () => {
			unsubscribe();
			scale.stopAnimation();
		};
	}, [fontScale, reduceMotion, scale]);
	return scale;
}

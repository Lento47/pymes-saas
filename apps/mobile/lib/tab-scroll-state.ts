export const COMPACT_CAPSULE_SCALE = 0.94;

/** Separate thresholds prevent jitter near the top and ignore pull-to-refresh bounce. */
export function compactCapsuleAt(offset: number, compact: boolean): boolean {
	if (!Number.isFinite(offset)) return compact;
	if (offset <= 8) return false;
	return offset >= 72 || compact;
}

/** Only the focused vertical scroller can change the visible navigation capsule. */
export function createTabScrollState() {
	let active: symbol | null = null;
	let compact = false;
	const listeners = new Set<() => void>();
	const publish = (next: boolean) => {
		if (next === compact) return;
		compact = next;
		for (const listener of listeners) listener();
	};
	return {
		getSnapshot: () => compact,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		activate: (source: symbol, next: boolean) => {
			active = source;
			publish(next);
		},
		update: (source: symbol, next: boolean) => {
			if (source === active) publish(next);
		},
		deactivate: (source: symbol) => {
			if (source !== active) return;
			active = null;
			publish(false);
		},
	};
}

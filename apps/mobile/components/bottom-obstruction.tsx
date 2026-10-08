import { useIsFocused } from "expo-router";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useId,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";

type Registry = {
	height: number;
	set: (id: string, height: number | null) => void;
};

const BottomObstructionContext = createContext<Registry | null>(null);

/** Measured distance from the window bottom to the top of persistent controls. */
export function BottomObstructionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [heights, setHeights] = useState<ReadonlyMap<string, number>>(
		new Map(),
	);
	const set = useCallback((id: string, height: number | null) => {
		setHeights((previous) => {
			if (height === null ? !previous.has(id) : previous.get(id) === height) {
				return previous;
			}
			const next = new Map(previous);
			if (height === null) next.delete(id);
			else next.set(id, height);
			return next;
		});
	}, []);
	const value = useMemo(
		() => ({ height: Math.max(0, ...heights.values()), set }),
		[heights, set],
	);
	return (
		<BottomObstructionContext value={value}>
			{children}
		</BottomObstructionContext>
	);
}

export function useBottomObstructionHeight() {
	return use(BottomObstructionContext)?.height ?? 0;
}

/** Hidden tabs remain mounted, so only the focused screen reserves space. */
export function useBottomObstruction(height: number) {
	const registry = use(BottomObstructionContext);
	const set = registry?.set;
	const focused = useIsFocused();
	const id = useId();
	useLayoutEffect(() => {
		if (!set || !focused || !Number.isFinite(height) || height <= 0) return;
		set(id, height);
		return () => set(id, null);
	}, [focused, height, id, set]);
}

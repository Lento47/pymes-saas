import {
	DEFAULT_MOBILE_CONFIGURATION,
	MOBILE_CONFIG_FRESHNESS_MS,
	type MobileConfiguration,
	mobileCategoryVisible,
	mobileControlEnabled,
	type PublishedMobileConfiguration,
	publishedMobileConfigurationSchema,
} from "@pymeshub/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { env } from "./env";
import { readMobileConfigurationCache } from "./mobile-configuration-cache";
import { useTRPC } from "./trpc/context";

type MobileConfigurationContext = {
	configuration: MobileConfiguration;
	revision: number;
	enabled: (id: string) => boolean;
	categoryVisible: (
		category: { id: string; parentId: string | null },
		all: readonly { id: string; parentId: string | null }[],
	) => boolean;
	refresh: () => Promise<unknown>;
};
const fallback: MobileConfigurationContext = {
	configuration: DEFAULT_MOBILE_CONFIGURATION,
	revision: 0,
	enabled: () => true,
	categoryVisible: () => true,
	refresh: async () => {},
};
const MobileContext = createContext<MobileConfigurationContext>(fallback);
const cacheKey = `pymeshub.mobile-configuration.v1:${env.apiUrl}`;

/** Public config is never a navigation/loading dependency and is never polled. */
export function MobileConfigurationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const [lastValidated, setLastValidated] =
		useState<PublishedMobileConfiguration | null>(null);
	const query = useQuery({
		...trpc.mobile.published.queryOptions(),
		select: (value) => publishedMobileConfigurationSchema.parse(value),
		staleTime: MOBILE_CONFIG_FRESHNESS_MS,
		refetchInterval: false,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		retry: false,
	});
	useEffect(() => {
		let mounted = true;
		void AsyncStorage.getItem(cacheKey)
			.then((raw) => {
				const stored = readMobileConfigurationCache(raw);
				if (!mounted || !stored) return;
				setLastValidated((latest) =>
					latest && latest.revision >= stored.snapshot.revision
						? latest
						: stored.snapshot,
				);
				if (
					!publishedMobileConfigurationSchema.safeParse(
						cache.getQueryData(trpc.mobile.published.queryKey()),
					).success
				) {
					cache.setQueryData(
						trpc.mobile.published.queryKey(),
						stored.snapshot,
						{ updatedAt: stored.savedAt },
					);
				}
			})
			.catch(() => {});
		return () => {
			mounted = false;
		};
	}, [cache, trpc]);
	useEffect(() => {
		if (!query.data) return;
		setLastValidated(query.data);
		void AsyncStorage.setItem(
			cacheKey,
			JSON.stringify({ snapshot: query.data, savedAt: query.dataUpdatedAt }),
		).catch(() => {});
	}, [query.data, query.dataUpdatedAt]);
	const refresh = useCallback(
		() =>
			cache.refetchQueries({
				queryKey: trpc.mobile.published.queryKey(),
				exact: true,
			}),
		[cache, trpc],
	);
	const snapshot = query.data ?? lastValidated;
	const configuration = snapshot?.configuration ?? DEFAULT_MOBILE_CONFIGURATION;
	const value = useMemo<MobileConfigurationContext>(
		() => ({
			configuration,
			revision: snapshot?.revision ?? 0,
			enabled: (id) => mobileControlEnabled(configuration, id),
			categoryVisible: (category, all) =>
				mobileCategoryVisible(configuration, category, all),
			refresh,
		}),
		[configuration, snapshot?.revision, refresh],
	);
	return (
		<MobileContext.Provider value={value}>{children}</MobileContext.Provider>
	);
}
export function useMobileConfiguration() {
	return useContext(MobileContext);
}

/** Filtering never mutates the taxonomy, selection or product assignments. */
export function useVisibleMobileCategories<T extends { id: string; parentId: string | null }>(items: readonly T[]): T[] {
	const { categoryVisible } = useMobileConfiguration();
	return useMemo(() => items.filter((item) => categoryVisible(item, items)), [categoryVisible, items]);
}

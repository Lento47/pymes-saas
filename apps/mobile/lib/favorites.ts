import type { BusinessCard, ProductCard } from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Alert } from "react-native";

import { messageKeyFor, toApiFailure } from "@/lib/api-error";
import { useSession } from "@/lib/auth/session";
import { warning } from "@/lib/haptics";
import { useT } from "@/lib/i18n";
import { useTRPC, useTRPCClient } from "@/lib/trpc/context";

/**
 * The heart, and what it costs to make it honest.
 *
 * `favorites.toggle` is the one write a browsing screen makes, and it is the shape
 * `docs/design-mobile.md` calls an **optimistic where the outcome is certain**: tapping a
 * heart has one possible outcome and it is known before the network answers, so the UI
 * commits immediately and the request catches up. The reciprocity is the speed — and the
 * rule attached to it is that speed must never be used to hide a refusal, which is why a
 * failure rolls the heart back and *says so* in the API's own sentence rather than quietly
 * emptying itself.
 *
 * ## Which card is the truth
 *
 * `favorites.list` is cached for the whole app, and the heart reads its state from that one
 * cache entry rather than keeping a copy per row — two hearts for one product that disagree
 * is the bug that comes of per-component state. The optimistic write goes into the same
 * entry, so a shop hearted from the feed is already filled when the same shop is opened.
 *
 * The list is only requested when somebody is signed in. `/favorites` is a
 * `protectedProcedure`, and firing it for a customer who has not signed in would be a 401
 * rendered over a feed that has nothing wrong with it.
 *
 * ## Add and remove are one call, deliberately
 *
 * `toggle` takes an id and no desired state, so a double tap that sends two requests lands
 * where the customer left it. This layer keeps that property: it sends the id, and it
 * trusts the response's `favorited` over its own arithmetic when the two disagree.
 */

export type Favorites = { businesses: BusinessCard[]; products: ProductCard[] };

/**
 * A thing that can be hearted.
 *
 * The card travels with the id because an optimistic *add* has to insert something into
 * the list, and the thing to insert is the card the customer is looking at. Sending it to
 * the API would be sending back what the API just gave us.
 */
export type FavoriteTarget =
	| { kind: "business"; card: BusinessCard }
	| { kind: "product"; card: ProductCard };

/** The list with `target` flipped — `createdAt desc` puts an add at the front, as the API does. */
function toggled(
	current: Favorites | undefined,
	target: FavoriteTarget,
): Favorites {
	const list = current ?? { businesses: [], products: [] };
	const id = target.card.id;

	if (target.kind === "business") {
		const present = list.businesses.some((business) => business.id === id);
		return {
			...list,
			businesses: present
				? list.businesses.filter((business) => business.id !== id)
				: [target.card, ...list.businesses],
		};
	}

	const present = list.products.some((product) => product.id === id);
	return {
		...list,
		products: present
			? list.products.filter((product) => product.id !== id)
			: [target.card, ...list.products],
	};
}

export function useFavorites() {
	const trpc = useTRPC();
	const client = useTRPCClient();
	const cache = useQueryClient();
	const { status } = useSession();
	const { t } = useT();

	const signedIn = status === "signed-in";
	const key = trpc.favorites.list.queryKey();

	const list = useQuery(
		trpc.favorites.list.queryOptions(undefined, { enabled: signedIn }),
	);

	const isFavorited = useCallback(
		(target: FavoriteTarget) => {
			const id = target.card.id;
			return target.kind === "business"
				? (list.data?.businesses.some((business) => business.id === id) ??
						false)
				: (list.data?.products.some((product) => product.id === id) ?? false);
		},
		[list.data],
	);

	const toggle = useMutation({
		mutationKey: trpc.favorites.toggle.mutationKey(),
		mutationFn: (target: FavoriteTarget) =>
			client.favorites.toggle.mutate(
				target.kind === "business"
					? { businessId: target.card.id }
					: { productId: target.card.id },
			),
		onMutate: async (target) => {
			// A read already in flight would land after the optimistic write and undo it,
			// so it is cancelled rather than raced.
			await cache.cancelQueries({ queryKey: key });
			const previous = cache.getQueryData<Favorites>(key);
			cache.setQueryData<Favorites>(key, (current) => toggled(current, target));
			return { previous };
		},
		onError: (error, _target, context) => {
			cache.setQueryData(key, context?.previous);
			// The haptic and the sentence are the two halves of "we took it back": one for a
			// phone in a pocket, one for a phone in a hand. Neither is optional.
			warning();
			Alert.alert(
				t("state.error.title"),
				t(messageKeyFor(toApiFailure(error))),
			);
		},
		onSettled: () => {
			// The server's answer replaces the guess in both directions, including the case
			// where a second tap arrived before the first one answered.
			void cache.invalidateQueries({ queryKey: key });
		},
	});

	/**
	 * `list` is handed back as the query rather than as its `data`, and the difference is
	 * `app/favorites.tsx`.
	 *
	 * Every heart on every card wants one thing from this read — the state of one id — which is
	 * what `isFavorited` is for. The screen that draws the whole thing needs three more that a
	 * heart never does: whether the read is still out, whether it failed and the error itself,
	 * and a way to ask again. Unwrapping `data` here would mean the one screen that needs the
	 * other three reaching for the query a second time, which is a second subscription to the
	 * same key with the same cache entry under it — two observers where one would do, and the
	 * read that the hearts are already holding open would be opened again beside it.
	 */
	return {
		isFavorited,
		toggle: toggle.mutate,
		signedIn,
		isPending: toggle.isPending,
		list,
	};
}

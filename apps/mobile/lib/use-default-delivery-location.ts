import type { Address } from "@pymeshub/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useSession } from "@/lib/auth/session";
import {
	deliveryAddressForPin,
	sameDeliveryPoint,
} from "@/lib/delivery-location";
import { useT } from "@/lib/i18n";
import { useTRPC } from "@/lib/trpc/context";

/** A map choice and the delivery address refer to the same point for this customer. */
export function useDefaultDeliveryLocation() {
	const trpc = useTRPC();
	const cache = useQueryClient();
	const { status, session } = useSession();
	const { t } = useT();
	const save = useMutation(trpc.users.saveAddress.mutationOptions());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const [address, setAddress] = useState<Address | null>(null);
	const mutate = save.mutateAsync;
	const ensureDefaultPoint = useCallback(
		async (point: { lat: number; lng: number }) => {
			// Browsing signed out keeps the map choice locally; checkout saves it after sign-in.
			if (status !== "signed-in" || !session?.userId) return null;
			setSaving(true);
			setError(null);
			try {
				const owned = await cache.fetchQuery(
					trpc.users.addresses.queryOptions(),
				);
				const input = deliveryAddressForPin(owned, point, t("location.pinned"));
				const current = owned.find((entry) => entry.id === input.id);
				const selected =
					current?.isDefault && sameDeliveryPoint(current, point)
						? current
						: await mutate(input);
				cache.setQueryData(trpc.users.addresses.queryKey(), [
					selected,
					...owned
						.filter((entry) => entry.id !== selected.id)
						.map((entry) => ({ ...entry, isDefault: false })),
				]);
				setAddress(selected);
				return selected;
			} catch (failure) {
				setError(failure);
				throw failure;
			} finally {
				setSaving(false);
			}
		},
		[cache, mutate, session?.userId, status, t, trpc],
	);
	return { ensureDefaultPoint, saving, error, address };
}

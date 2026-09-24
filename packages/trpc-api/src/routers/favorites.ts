import { z } from "zod";

import * as catalog from "../services/catalog";
import { protectedProcedure, router } from "../trpc";

/**
 * The heart on a shop card and on a product card.
 *
 * `toggle` takes one id or the other and never a "desired state": a client that sends
 * "favourite this" twice — a double tap, a retried request — ends up where it started, and
 * a client that sends a state it read a second ago would be a client that has to know the
 * server's state. The response says where the caller *is* now, not what changed.
 *
 * The input shape is declared here rather than in `@pymeshub/shared` because it is two
 * optional ids with an invariant, not a record either client stores — the type is inferred
 * from this router and travels to both clients through `AppRouter`.
 */
export const favoritesRouter = router({
	list: protectedProcedure.query(({ ctx }) => catalog.listFavorites(ctx)),

	toggle: protectedProcedure
		.input(
			z.object({
				businessId: z.string().optional(),
				productId: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) => catalog.toggleFavorite(ctx, input)),
});

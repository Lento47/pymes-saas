import { z } from "zod";
import * as catalog from "../services/catalog";
import { publicProcedure, router } from "../trpc";

/**
 * Browsing, before anybody has signed in.
 *
 * All three are public, and all three are reads: the home screen has to draw for a
 * customer who has not made an account yet, and asking them to sign in before they can see
 * what the marketplace sells is the wrong order to ask for anything in. Nothing here
 * returns a row scoped to a user, so there is nothing to leak.
 *
 * The inputs are declared here rather than in `@pymeshub/shared` because no client holds
 * them: a screen calls `catalog.feed` with coordinates and nothing else, and a shared
 * schema for "the query string somebody typed" would be a shape with one consumer.
 */
export const catalogRouter = router({
	categories: publicProcedure.query(({ ctx }) => catalog.categories(ctx)),

	feed: publicProcedure
		.input(
			z.object({
				lat: z.number().min(-90).max(90).optional(),
				lng: z.number().min(-180).max(180).optional(),
				limit: z.number().int().min(1).max(50).optional(),
			}),
		)
		.query(({ ctx, input }) => catalog.feed(ctx, input)),

	search: publicProcedure
		.input(
			z.object({
				q: z.string().trim().min(1).max(120),
				lat: z.number().min(-90).max(90).optional(),
				lng: z.number().min(-180).max(180).optional(),
			}),
		)
		.query(({ ctx, input }) => catalog.search(ctx, input)),
});

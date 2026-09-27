import { uploadCreateInput } from "@pymeshub/shared";

import * as uploads from "../services/uploads";
import { protectedProcedure, router } from "../trpc";

/**
 * One picture, stored, and the path that draws it.
 *
 * `protectedProcedure` and not `businessProcedure`: a product photo belongs to a
 * shop, an avatar belongs to a person, and both are the same bytes on the same row.
 * The caller is whoever is signed in, the row records `ownerUserId`, and the thing
 * the picture is *attached to* is a write on its own procedure (`products.update`,
 * `users.updateProfile`) which already knows its tenant. Splitting uploads by
 * destination would mean the same file landing in two tables depending on a
 * parameter nobody reads.
 *
 * No `delete` here, and that is deliberate for now: an orphaned object costs one
 * row and is findable by `ownerUserId`, while a delete that is reachable before the
 * row pointing at it is rewritten is a broken picture on a storefront. Replacing a
 * photo is a create plus a write on the product — the old row can be swept.
 */
export const uploadsRouter = router({
	create: protectedProcedure
		.input(uploadCreateInput)
		.mutation(({ ctx, input }) => uploads.create(ctx, input)),
});

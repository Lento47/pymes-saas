import {
	addressInput,
	updatePreferencesInput,
	updateProfileInput,
} from "@pymeshub/shared";
import { z } from "zod";

import * as users from "../services/users";
import { protectedProcedure, router } from "../trpc";

/**
 * The customer's own record: their profile and their addresses.
 *
 * Neither takes a `userId`, because there is no such input to trust — the scope is
 * `ctx.user.id`, the id on the row `context.ts` resolved from the caller's session. That
 * is why this router can stay this thin: there is no "which user" question to get wrong.
 *
 * `me` is an ordinary read of a row that already exists — Better Auth wrote it when the
 * account was created, and nothing here reconciles it with a second identity store any
 * more. It is still `protected`, because the row it returns is the caller's own. The
 * notification list is `notifications.list` under its own namespace, not a procedure
 * here.
 */
export const usersRouter = router({
	me: protectedProcedure.query(({ ctx }) => users.me(ctx)),

	updateProfile: protectedProcedure
		.input(updateProfileInput)
		.mutation(({ ctx, input }) => users.updateProfile(ctx, input)),

	notificationPrefs: protectedProcedure.query(({ ctx }) =>
		users.notificationPrefs(ctx),
	),

	updatePreferences: protectedProcedure
		.input(updatePreferencesInput)
		.mutation(({ ctx, input }) => users.updatePreferences(ctx, input)),

	addresses: protectedProcedure.query(({ ctx }) => users.listAddresses(ctx)),

	// `id` present means "edit that one", absent means "add another". One procedure rather
	// than two because the address form is the same form either way, and the alternative —
	// a create that quietly adds a duplicate when the client meant to edit — is the bug this
	// shape prevents.
	saveAddress: protectedProcedure
		.input(addressInput.extend({ id: z.string().optional() }))
		.mutation(({ ctx, input }) => users.saveAddress(ctx, input)),

	deleteAddress: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => users.deleteAddress(ctx, input)),
});
